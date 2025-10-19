import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Calculator,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Target,
  TrendingUp,
  Factory,
  Package,
  Users,
  User,
  Plus,
  X,
} from "lucide-react";
import { Tables, Enums } from "@/integrations/supabase/types";

type Maquina = Tables<"maquinas">;
type Producto = Tables<"productos">;
type Usuario = Tables<"usuarios">;
type DisenoArbol = Tables<"disenos_arboles">;
type NivelRama = Tables<"niveles_ramas">;
type RamaAmarradora = {
  id: string;
  diseno_id: string;
  numero_rama: number;
  tope_rama: number;
};

interface NivelDetalle {
  nivel: number;
  cantidad_ramas: number;
  festones_por_rama: number;
}

interface RamaAmarradoraDetalle {
  numero_rama: number;
  cantidad_producida: number;
  tope_rama: number;
}

interface ProductoDetalle {
  producto_id: string; // quedará vacío hasta que el usuario seleccione
  produccion_real: number;
  observaciones?: string;
  niveles?: NivelDetalle[];
  ramas_amarradora?: RamaAmarradoraDetalle[];
}

interface FormData {
  fecha: string;
  turno: Enums<"turno_produccion"> | "";
  categoria_maquina: string;
  maquina_id: string;
  operario_principal_id: string;
  productos: ProductoDetalle[];
  asistentes: string[];
}

// ===== Helpers de jornada (clave para amarradora) =====
const isTenHourShift = (turno: string) => (turno || "").replace(/\s+/g, "").toLowerCase() === "7:00am-5:00pm";
const jornadaFactor = (turno: string) => (isTenHourShift(turno) ? 1.25 : 1); // 10h/8h

export default function RegistroProduccion() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState<FormData>({
    fecha: new Date().toISOString().split("T")[0],
    turno: "",
    categoria_maquina: "",
    maquina_id: "",
    operario_principal_id: "",
    productos: [],
    asistentes: [],
  });

  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [filteredMaquinas, setFilteredMaquinas] = useState<Maquina[]>([]);
  const [categoriasMaquinas, setCategoriasMaquinas] = useState<string[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [filteredProductos, setFilteredProductos] = useState<Producto[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [filteredUsuarios, setFilteredUsuarios] = useState<Usuario[]>([]);
  const [searchUsuarios, setSearchUsuarios] = useState(""); // buscador operario principal
  const [searchProductos, setSearchProductos] = useState("");
  const [disenosArboles, setDisenosArboles] = useState<DisenoArbol[]>([]);
  const [nivelesRamas, setNivelesRamas] = useState<NivelRama[]>([]);
  const [ramasAmarradora, setRamasAmarradora] = useState<RamaAmarradora[]>([]);
  const [porcentajeCumplimiento, setPorcentajeCumplimiento] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // NUEVO: estado para UI de asistentes (sin listar por defecto)
  const [asistentesOpen, setAsistentesOpen] = useState(false);
  const [searchAsistente, setSearchAsistente] = useState("");

  const turnos: Enums<"turno_produccion">[] = [
    "6:00am - 2:00pm",
    "2:00pm - 10:00pm",
    "10:00pm - 6:00am",
    "7:00am - 5:00pm",
    "7:00am - 3:00pm",
    "7:00am - 3:30pm",
  ];

  useEffect(() => {
    loadInitialData();
  }, []);

  // Filtrar máquinas por categoría
  useEffect(() => {
    if (formData.categoria_maquina) {
      const filtered = maquinas.filter((m) => m.categoria === formData.categoria_maquina);
      setFilteredMaquinas(filtered);
    } else {
      setFilteredMaquinas([]);
    }
  }, [formData.categoria_maquina, maquinas]);

  // Filtrar productos por máquina seleccionada + buscador
  useEffect(() => {
    if (formData.maquina_id) {
      const maquinaSeleccionada = maquinas.find((m) => m.id === formData.maquina_id);
      if (maquinaSeleccionada?.categoria) {
        const filteredByCategory = productos.filter((p) => p.categoria === maquinaSeleccionada.categoria);
        const filteredWithSearch = filteredByCategory.filter((p) =>
          p.nombre.toLowerCase().includes(searchProductos.toLowerCase()),
        );
        setFilteredProductos(filteredWithSearch);

        // limpiar productos no válidos según la nueva máquina
        const validProductos = formData.productos.filter((p) =>
          filteredByCategory.find((fp) => fp.id === p.producto_id),
        );
        if (validProductos.length !== formData.productos.length) {
          setFormData((prev) => ({ ...prev, productos: validProductos }));
        }
      } else {
        setFilteredProductos([]);
        setFormData((prev) => ({ ...prev, productos: [] }));
      }
    } else {
      setFilteredProductos([]);
      setFormData((prev) => ({ ...prev, productos: [] }));
    }
  }, [formData.maquina_id, productos, maquinas, searchProductos]);

  useEffect(() => {
    calculatePerformance();
  }, [formData.productos, formData.turno, productos]);

  useEffect(() => {
    const filtered = usuarios.filter((usuario) => usuario.nombre.toLowerCase().includes(searchUsuarios.toLowerCase()));
    setFilteredUsuarios(filtered);
  }, [usuarios, searchUsuarios]);

  const loadInitialData = async () => {
    try {
      setDataLoading(true);

      const [maquinasResult, productosResult, usuariosResult, disenosResult, nivelesResult, ramasResult] =
        await Promise.all([
          supabase.from("maquinas").select("*").eq("activa", true).order("nombre"),
          supabase.from("productos").select("*").eq("activo", true).order("nombre"),
          supabase
            .from("usuarios")
            .select("*")
            .eq("activo", true)
            .neq("id", user?.id || "")
            .neq("tipo_usuario", "admin")
            .order("nombre"),
          supabase.from("disenos_arboles").select("*").eq("activo", true).order("nombre"),
          supabase.from("niveles_ramas").select("*").eq("activo", true).order("nivel"),
          supabase.from("ramas_amarradora").select("*").eq("activo", true).order("numero_rama"),
        ]);

      if (maquinasResult.error) throw maquinasResult.error;
      if (productosResult.error) throw productosResult.error;
      if (usuariosResult.error) throw usuariosResult.error;
      if (disenosResult.error) throw disenosResult.error;
      if (nivelesResult.error) throw nivelesResult.error;
      if (ramasResult.error) throw ramasResult.error;

      setMaquinas(maquinasResult.data || []);
      setProductos(productosResult.data || []);
      setUsuarios(usuariosResult.data || []);
      setDisenosArboles(disenosResult.data || []);
      setNivelesRamas(nivelesResult.data || []);
      setRamasAmarradora((ramasResult.data as RamaAmarradora[]) || []);

      // Extraer categorías únicas de máquinas
      const categorias = Array.from(
        new Set(
          (maquinasResult.data || [])
            .map((m) => m.categoria)
            .filter((c): c is string => c !== null && c !== undefined && c !== ""),
        ),
      ).sort();
      setCategoriasMaquinas(categorias);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos iniciales",
        variant: "destructive",
      });
    } finally {
      setDataLoading(false);
    }
  };

  // ====== TOPE por producto (incluye amarradora con variación por jornada) ======
  const getTopeForProduct = (productoInfo: Producto, turno: string): number => {
    if (productoInfo.tipo_producto === "arbol_amarradora") {
      // Si deseas mostrar un "tope" en el resumen, escálalo por jornada (10h en 7–5)
      const base = Number(productoInfo.tope) || 0; // base ~ 8h
      return base > 0 ? base * jornadaFactor(turno) : 0;
    }
    // Resto de productos: 10h para 7–5, 8h para los demás
    if (isTenHourShift(turno)) {
      return Number(productoInfo.tope_jornada_10h) || 0;
    }
    return Number(productoInfo.tope_jornada_8h) || 0;
  };

  const calculatePerformance = () => {
    if (!formData.productos.length || !formData.turno) {
      setPorcentajeCumplimiento(0);
      return;
    }

    let totalProduccionReal = 0;
    let totalMeta = 0;

    formData.productos.forEach((producto) => {
      if (!producto.producto_id) return;

      const productoInfo = productos.find((p) => p.id === producto.producto_id);
      if (!productoInfo) return;

      if (productoInfo.tipo_producto === "arbol_amarradora") {
        // ⚠️ calcular en tiempo real con el turno actual
        const avg = calculatePromedioRamas(producto.ramas_amarradora || [], formData.turno as string);
        totalProduccionReal += avg; // 0–100
        totalMeta += 100;
      } else {
        const tope = getTopeForProduct(productoInfo, formData.turno as string);
        if (tope > 0) {
          totalProduccionReal += producto.produccion_real;
          totalMeta += tope;
        }
      }
    });

    if (totalMeta > 0) {
      const porcentaje = (totalProduccionReal / totalMeta) * 100;
      setPorcentajeCumplimiento(porcentaje);
    } else {
      setPorcentajeCumplimiento(0);
    }
  };

  const adjustDateForNightShift = (fecha: string, turno: string): string => {
    if (turno === "10:00pm - 6:00am") {
      const date = new Date(fecha);
      date.setDate(date.getDate() + 1);
      return date.toISOString().split("T")[0];
    }
    return fecha;
  };

  const handleInputChange = (
    field: "fecha" | "turno" | "categoria_maquina" | "maquina_id" | "operario_principal_id",
    value: string,
  ) => {
    if (field === "categoria_maquina") {
      // Al cambiar categoría, resetear máquina y productos
      setFormData((prev) => ({
        ...prev,
        categoria_maquina: value,
        maquina_id: "",
        productos: [],
      }));
    } else if (field === "maquina_id") {
      // Al cambiar máquina, resetear productos
      setFormData((prev) => ({
        ...prev,
        maquina_id: value,
        productos: [],
      }));
    } else if (field === "operario_principal_id") {
      // Si cambia el operario principal, removerlo de asistentes si está
      setFormData((prev) => ({
        ...prev,
        operario_principal_id: value,
        asistentes: prev.asistentes.filter((id) => id !== value),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  // ——— no se preselecciona ningún producto
  const addProducto = () => {
    const newProducto: ProductoDetalle = {
      producto_id: "",
      produccion_real: 0,
      observaciones: "",
      niveles: undefined,
    };
    setFormData((prev) => ({
      ...prev,
      productos: [...prev.productos, newProducto],
    }));
  };

  const initializeNiveles = (disenoId: string): NivelDetalle[] => {
    const niveles = nivelesRamas.filter((n) => n.diseno_id === disenoId);
    return niveles.map((nivel) => ({
      nivel: nivel.nivel,
      cantidad_ramas: 0,
      festones_por_rama: nivel.festones_por_rama,
    }));
  };

  const initializeRamasAmarradora = (disenoId: string): RamaAmarradoraDetalle[] => {
    const ramas = ramasAmarradora.filter((r) => r.diseno_id === disenoId);
    return ramas.map((rama) => ({
      numero_rama: rama.numero_rama,
      cantidad_producida: 0,
      tope_rama: Number(rama.tope_rama),
    }));
  };

  // ===== Ajuste de % por rama con factor de jornada =====
  const calculatePromedioRamas = (ramas: RamaAmarradoraDetalle[] | undefined, turno: string): number => {
    if (!ramas || ramas.length === 0) return 0;
    const factor = jornadaFactor(turno); // 1.25 si 7–5
    const totalPorcentaje = ramas.reduce((sum, rama) => {
      const topeEfectivo = Number(rama.tope_rama) * factor;
      const pct = topeEfectivo > 0 ? (Number(rama.cantidad_producida) / topeEfectivo) * 100 : 0;
      return sum + pct;
    }, 0);
    return totalPorcentaje / ramas.length;
  };

  const updateProductoRamaAmarradora = (productoIndex: number, ramaIndex: number, cantidadProducida: number) => {
    setFormData((prev) => ({
      ...prev,
      productos: prev.productos.map((producto, i) => {
        if (i === productoIndex && producto.ramas_amarradora) {
          const updatedRamas = producto.ramas_amarradora.map((rama, j) =>
            j === ramaIndex ? { ...rama, cantidad_producida: cantidadProducida } : rama,
          );
          const promedioPorcentaje = calculatePromedioRamas(updatedRamas, formData.turno as string);
          return {
            ...producto,
            ramas_amarradora: updatedRamas,
            produccion_real: promedioPorcentaje, // aquí guardamos el % promedio (0–100)
          };
        }
        return producto;
      }),
    }));
  };

  const calculateFestones = (niveles: NivelDetalle[]): number => {
    return niveles.reduce((total, nivel) => total + nivel.cantidad_ramas * nivel.festones_por_rama, 0);
  };

  const updateProductoNivel = (productoIndex: number, nivelIndex: number, cantidadRamas: number) => {
    setFormData((prev) => ({
      ...prev,
      productos: prev.productos.map((producto, i) => {
        if (i === productoIndex && producto.niveles) {
          const updatedNiveles = producto.niveles.map((nivel, j) =>
            j === nivelIndex ? { ...nivel, cantidad_ramas: cantidadRamas } : nivel,
          );
          const totalFestones = calculateFestones(updatedNiveles);
          return {
            ...producto,
            niveles: updatedNiveles,
            produccion_real: totalFestones,
          };
        }
        return producto;
      }),
    }));
  };

  const removeProducto = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      productos: prev.productos.filter((_, i) => i !== index),
    }));
  };

  const updateProducto = (
    index: number,
    field: "producto_id" | "produccion_real" | "observaciones",
    value: string | number,
  ) => {
    setFormData((prev) => ({
      ...prev,
      productos: prev.productos.map((producto, i) => {
        if (i === index) {
          if (field === "producto_id") {
            const selectedProduct = filteredProductos.find((p) => p.id === (value as string));
            if (selectedProduct?.tipo_producto === "arbol_navideno") {
              return {
                producto_id: value as string,
                niveles: initializeNiveles(selectedProduct.diseno_id!),
                produccion_real: 0,
                observaciones: producto.observaciones || "",
                ramas_amarradora: undefined,
              };
            } else if (selectedProduct?.tipo_producto === "arbol_amarradora") {
              return {
                producto_id: value as string,
                ramas_amarradora: initializeRamasAmarradora(selectedProduct.diseno_id!),
                produccion_real: 0,
                observaciones: producto.observaciones || "",
                niveles: undefined,
              };
            } else {
              return {
                producto_id: value as string,
                produccion_real: producto.produccion_real,
                observaciones: producto.observaciones || "",
                niveles: undefined,
                ramas_amarradora: undefined,
              };
            }
          } else if (field === "observaciones") {
            return { ...producto, observaciones: value as string };
          } else {
            return { ...producto, [field]: value as number };
          }
        }
        return producto;
      }),
    }));
  };

  const toggleAsistente = (asistenteId: string) => {
    // Validar que el operario principal no pueda ser asistente
    if (asistenteId === formData.operario_principal_id) {
      toast({
        title: "Validación",
        description: "El operario principal no puede ser asistente en el mismo registro",
        variant: "destructive",
      });
      return;
    }

    setFormData((prev) => ({
      ...prev,
      asistentes: prev.asistentes.includes(asistenteId)
        ? prev.asistentes.filter((id) => id !== asistenteId)
        : [...prev.asistentes, asistenteId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Error",
        description: "No se encontró información del usuario",
        variant: "destructive",
      });
      return;
    }

    if (!formData.turno || !formData.maquina_id || !formData.operario_principal_id || !formData.productos.length) {
      toast({
        title: "Campos Requeridos",
        description:
          "Por favor completa todos los campos del formulario, selecciona el operario principal y agrega al menos un producto",
        variant: "destructive",
      });
      return;
    }

    // ——— Validar que todas las líneas tengan producto seleccionado
    const productosSinSeleccion = formData.productos.filter((p) => !p.producto_id);
    if (productosSinSeleccion.length > 0) {
      toast({
        title: "Productos incompletos",
        description: "Hay líneas de producto sin selección. Elige un producto o elimínalas.",
        variant: "destructive",
      });
      return;
    }

    // ——— Validar cantidades (> 0) solo para seleccionados
    const invalidProducts = formData.productos.filter((p) => !!p.producto_id).filter((p) => p.produccion_real <= 0);
    if (invalidProducts.length > 0) {
      toast({
        title: "Cantidades Inválidas",
        description: "Todos los productos seleccionados deben tener una cantidad mayor a 0",
        variant: "destructive",
      });
      return;
    }

    // ——— Validar niveles para árboles navideños
    const invalidTreeProducts = formData.productos.filter((producto) => {
      if (!producto.producto_id) return false;
      const selectedProduct = filteredProductos.find((p) => p.id === producto.producto_id);
      if (selectedProduct?.tipo_producto === "arbol_navideno" && producto.niveles) {
        const totalRamas = producto.niveles.reduce((sum, nivel) => sum + nivel.cantidad_ramas, 0);
        return totalRamas === 0;
      }
      return false;
    });
    if (invalidTreeProducts.length > 0) {
      toast({
        title: "Niveles Requeridos",
        description: "Los productos de árbol navideño deben tener al menos un nivel con ramas",
        variant: "destructive",
      });
      return;
    }

    // ——— Validar ramas para árboles amarradora (opcional)
    const invalidAmarradoraProducts = formData.productos.filter((producto) => {
      if (!producto.producto_id) return false;
      const selectedProduct = filteredProductos.find((p) => p.id === producto.producto_id);
      if (selectedProduct?.tipo_producto === "arbol_amarradora" && producto.ramas_amarradora) {
        return false;
      }
      return false;
    });

    setLoading(true);

    try {
      const fechaAjustada = adjustDateForNightShift(formData.fecha, formData.turno as string);

      const { data: registro, error: registroError } = await supabase
        .from("registros_produccion")
        .insert({
          fecha: fechaAjustada,
          turno: formData.turno,
          operario_id: formData.operario_principal_id,
          maquina_id: formData.maquina_id,
          es_asistente: false,
        })
        .select()
        .single();

      if (registroError) throw registroError;

      const detallesPromises = formData.productos
        .filter((p) => !!p.producto_id) // seguridad extra
        .map(async (producto) => {
          const productoInfo = productos.find((p) => p.id === producto.producto_id)!;

          // Para árboles amarradora, calcular la suma total de ramas producidas
          let porcentajeProducto = 0;
          let produccionRealValue = producto.produccion_real;

          if (productoInfo.tipo_producto === "arbol_amarradora") {
            // Calcular suma total de ramas producidas (dato crudo)
            const totalRamasProducidas =
              producto.ramas_amarradora?.reduce((sum, rama) => sum + rama.cantidad_producida, 0) || 0;

            // produccion_real = suma total de ramas producidas
            produccionRealValue = totalRamasProducidas;
            // porcentaje = promedio de cumplimiento por rama (YA AJUSTADO por jornada)
            porcentajeProducto = producto.produccion_real;
          } else {
            const tope = getTopeForProduct(productoInfo, formData.turno as string);
            porcentajeProducto = tope > 0 ? (producto.produccion_real / tope) * 100 : 0;
            produccionRealValue = producto.produccion_real;
          }

          const { data: detalleData, error: detalleError } = await supabase
            .from("detalle_produccion")
            .insert({
              registro_id: registro.id,
              producto_id: producto.producto_id,
              produccion_real: produccionRealValue,
              porcentaje_cumplimiento: porcentajeProducto,
              observaciones: producto.observaciones || null,
            })
            .select()
            .single();

          if (detalleError) throw detalleError;

          // Si es árbol amarradora, guardar detalles de ramas
          if (productoInfo.tipo_producto === "arbol_amarradora" && producto.ramas_amarradora) {
            const ramasPromises = producto.ramas_amarradora.map((rama) =>
              supabase.from("detalle_ramas_amarradora").insert({
                detalle_produccion_id: detalleData.id,
                numero_rama: rama.numero_rama,
                cantidad_producida: rama.cantidad_producida,
                tope_rama: rama.tope_rama,
              }),
            );

            const ramasResults = await Promise.all(ramasPromises);
            const ramasErrors = ramasResults.filter((result) => (result as any).error);
            if (ramasErrors.length > 0) {
              throw (ramasErrors[0] as any).error;
            }
          }

          return { data: detalleData, error: null };
        });

      const detallesResults = await Promise.all(detallesPromises);
      const detallesErrors = detallesResults.filter((result) => (result as any).error);
      if (detallesErrors.length > 0) {
        throw (detallesErrors[0] as any).error;
      }

      if (formData.asistentes.length > 0) {
        // Crear registros en tabla pivote (para trazabilidad)
        const asistentesPromises = formData.asistentes.map((asistenteId) =>
          supabase.from("registro_asistentes").insert({
            registro_id: registro.id,
            asistente_id: asistenteId,
          }),
        );

        const asistentesResults = await Promise.all(asistentesPromises);
        const asistentesErrors = asistentesResults.filter((result) => (result as any).error);
        if (asistentesErrors.length > 0) {
          throw (asistentesErrors[0] as any).error;
        }

        // Crear registros individuales de producción para cada ayudante
        const registrosAsistentesPromises = formData.asistentes.map((asistenteId) =>
          supabase.from("registros_produccion").insert({
            fecha: fechaAjustada,
            turno: formData.turno as any,
            operario_id: asistenteId,
            maquina_id: formData.maquina_id,
            es_asistente: true,
          }),
        );

        const registrosAsistentesResults = await Promise.all(registrosAsistentesPromises);
        const registrosAsistentesErrors = registrosAsistentesResults.filter((result) => (result as any).error);
        if (registrosAsistentesErrors.length > 0) {
          throw (registrosAsistentesErrors[0] as any).error;
        }
      }

      toast({
        title: "¡Registro Guardado!",
        description: `Producción registrada exitosamente con ${porcentajeCumplimiento.toFixed(1)}% de cumplimiento`,
      });

      setFormData({
        fecha: new Date().toISOString().split("T")[0],
        turno: "",
        categoria_maquina: "",
        maquina_id: "",
        operario_principal_id: "",
        productos: [],
        asistentes: [],
      });
      setPorcentajeCumplimiento(0);
      setAsistentesOpen(false);
      setSearchAsistente("");
    } catch (error: any) {
      console.error("Error saving record:", error);
      toast({
        title: "Error al Guardar",
        description: error.message || "No se pudo guardar el registro",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPerformanceColor = (percentage: number) => {
    if (percentage >= 100) return "text-success";
    if (percentage >= 80) return "text-primary";
    if (percentage >= 60) return "text-warning";
    return "text-destructive";
  };

  const getPerformanceIcon = (percentage: number) => {
    if (percentage >= 100) return <CheckCircle className="h-5 w-5" />;
    if (percentage >= 80) return <TrendingUp className="h-5 w-5" />;
    return <AlertTriangle className="h-5 w-5" />;
  };

  if (dataLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/2 mb-4"></div>
          <Card>
            <CardHeader>
              <div className="h-6 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-full"></div>
            </CardHeader>
            <CardContent className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-muted rounded w-1/4"></div>
                  <div className="h-10 bg-muted rounded"></div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Candidatos a asistentes (no listado por defecto; se filtra sólo cuando hay búsqueda)
  const candidatosAsistentes = usuarios
    .filter((u) => u.tipo_usuario === "operario" && u.activo)
    .filter((u) => u.id !== formData.operario_principal_id) // evitar duplicar operario principal
    .filter((u) => !formData.asistentes.includes(u.id)) // evitar repetidos
    .filter((u) =>
      searchAsistente.length >= 2
        ? u.nombre.toLowerCase().includes(searchAsistente.toLowerCase()) ||
          (u.cedula || "").toLowerCase().includes(searchAsistente.toLowerCase())
        : false,
    );

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <FileText className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Registro de Producción</h1>
          <p className="text-muted-foreground">Registra la producción de tu turno</p>
        </div>
      </div>

      <Card className="shadow-[var(--shadow-elevated)]">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calculator className="h-5 w-5 text-accent" />
            <span>Formulario de Registro</span>
          </CardTitle>
          <CardDescription>Completa todos los campos para registrar la producción</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* === Operario principal y Asistentes === */}
            <div className="space-y-2">
              <Label htmlFor="operario" className="flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span>Operario Principal *</span>
              </Label>
              <div className="space-y-2">
                {/* Buscador de operarios */}
                <Input
                  type="text"
                  placeholder="Buscar operario por nombre o cédula..."
                  value={searchUsuarios}
                  onChange={(e) => setSearchUsuarios(e.target.value)}
                  className="input-touch"
                />
                <Select
                  value={formData.operario_principal_id}
                  onValueChange={(value) => handleInputChange("operario_principal_id", value)}
                >
                  <SelectTrigger className="input-touch">
                    <SelectValue placeholder="Selecciona el operario principal" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50 max-h-48 overflow-y-auto">
                    {filteredUsuarios
                      .filter((u) => u.tipo_usuario === "operario" && u.activo)
                      .map((usuario) => (
                        <SelectItem key={usuario.id} value={usuario.id}>
                          {usuario.nombre} - {usuario.cedula}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Operarios Asistentes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center space-x-2">
                  <Users className="h-4 w-4" />
                  <span>Operarios Asistentes</span>
                </Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setAsistentesOpen((v) => !v)}>
                    {asistentesOpen ? "Cerrar" : "Agregar asistente"}
                  </Button>
                </div>
              </div>

              {/* Chips con asistentes seleccionados */}
              {formData.asistentes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {formData.asistentes.map((asistenteId) => {
                    const asistente = usuarios.find((u) => u.id === asistenteId);
                    return asistente ? (
                      <Badge key={asistenteId} variant="secondary" className="flex items-center space-x-1">
                        <span>{asistente.nombre}</span>
                        <button
                          type="button"
                          onClick={() => toggleAsistente(asistenteId)}
                          className="ml-1 text-muted-foreground hover:text-foreground"
                          aria-label={`Quitar ${asistente.nombre}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin asistentes seleccionados.</p>
              )}

              {/* Picker colapsable */}
              {asistentesOpen && (
                <div className="space-y-2 border rounded-lg p-3">
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="Escribe al menos 2 caracteres para buscar…"
                      value={searchAsistente}
                      onChange={(e) => setSearchAsistente(e.target.value)}
                      className="pl-10 input-touch"
                    />
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>

                  {searchAsistente.length < 2 ? (
                    <p className="text-xs text-muted-foreground">Empieza a escribir para ver resultados.</p>
                  ) : candidatosAsistentes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No se encontraron coincidencias.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-44 overflow-y-auto">
                      {candidatosAsistentes.map((usuario) => (
                        <div
                          key={usuario.id}
                          className="flex items-center space-x-3 p-2 rounded-lg border hover:bg-muted/50"
                        >
                          <Checkbox
                            id={`asistente-${usuario.id}`}
                            checked={formData.asistentes.includes(usuario.id)}
                            onCheckedChange={() => toggleAsistente(usuario.id)}
                          />
                          <Label
                            htmlFor={`asistente-${usuario.id}`}
                            className="text-sm font-medium cursor-pointer flex-1"
                          >
                            {usuario.nombre}
                            <span className="text-xs text-muted-foreground block">{usuario.cedula}</span>
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Fecha y Turno */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha de Producción</Label>
                <Input
                  id="fecha"
                  type="date"
                  value={formData.fecha}
                  onChange={(e) => handleInputChange("fecha", e.target.value)}
                  className="input-touch"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="turno">Turno</Label>
                <Select value={formData.turno} onValueChange={(value) => handleInputChange("turno", value)}>
                  <SelectTrigger className="input-touch">
                    <SelectValue placeholder="Selecciona el turno" />
                  </SelectTrigger>
                  <SelectContent>
                    {turnos.map((turno) => (
                      <SelectItem key={turno} value={turno}>
                        {turno}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Categoría de Máquina */}
            <div className="space-y-2">
              <Label htmlFor="categoria" className="flex items-center space-x-2">
                <Factory className="h-4 w-4" />
                <span>Categoría de Máquina *</span>
              </Label>
              <Select
                value={formData.categoria_maquina}
                onValueChange={(value) => handleInputChange("categoria_maquina", value)}
              >
                <SelectTrigger className="input-touch">
                  <SelectValue placeholder="Selecciona la categoría" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {categoriasMaquinas.map((categoria) => (
                    <SelectItem key={categoria} value={categoria}>
                      {categoria}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Máquina - Solo se muestra si hay categoría seleccionada */}
            {formData.categoria_maquina && (
              <div className="space-y-2">
                <Label htmlFor="maquina" className="flex items-center space-x-2">
                  <Factory className="h-4 w-4" />
                  <span>Máquina *</span>
                </Label>
                <Select value={formData.maquina_id} onValueChange={(value) => handleInputChange("maquina_id", value)}>
                  <SelectTrigger className="input-touch">
                    <SelectValue placeholder="Selecciona la máquina" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {filteredMaquinas.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">No hay máquinas en esta categoría</div>
                    ) : (
                      filteredMaquinas.map((maquina) => (
                        <SelectItem key={maquina.id} value={maquina.id}>
                          {maquina.nombre}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Productos */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="flex items-center space-x-2">
                  <Package className="h-4 w-4" />
                  <span>Productos Fabricados</span>
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addProducto}
                  disabled={!formData.maquina_id || filteredProductos.length === 0}
                  className="flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Agregar Producto</span>
                </Button>
              </div>

              {/* Buscador de productos */}
              {formData.maquina_id && (
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Buscar productos por nombre..."
                    value={searchProductos}
                    onChange={(e) => setSearchProductos(e.target.value)}
                    className="pl-10 input-touch"
                  />
                  <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              )}

              {formData.productos.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-muted rounded-lg">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {formData.maquina_id
                      ? "Agrega los productos fabricados en este turno"
                      : "Primero selecciona una máquina"}
                  </p>
                </div>
              )}

              {formData.productos.map((producto, index) => {
                const selectedProduct = producto.producto_id
                  ? filteredProductos.find((p) => p.id === producto.producto_id) ||
                    productos.find((p) => p.id === producto.producto_id)
                  : undefined;

                return (
                  <Card key={index} className="p-4">
                    <div className="space-y-4">
                      {/* Producto y eliminar */}
                      <div className="flex items-center space-x-4">
                        <div className="flex-1">
                          <Label className="text-sm font-medium">Producto</Label>
                          <Select
                            value={producto.producto_id}
                            onValueChange={(value) => updateProducto(index, "producto_id", value)}
                          >
                            <SelectTrigger className="input-touch">
                              <SelectValue placeholder="Selecciona el producto" />
                            </SelectTrigger>
                            <SelectContent className="bg-background z-50">
                              {filteredProductos.map((prod) => (
                                <SelectItem key={prod.id} value={prod.id}>
                                  {prod.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeProducto(index)}
                          className="mt-6 text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Solo mostrar detalles cuando haya producto seleccionado */}
                      {!selectedProduct ? (
                        <div className="p-3 border rounded-lg text-sm text-muted-foreground bg-muted/30">
                          Selecciona un producto para ingresar cantidades.
                        </div>
                      ) : selectedProduct.tipo_producto === "arbol_navideno" && producto.niveles ? (
                        <>
                          {/* Niveles árbol navideño */}
                          <div className="space-y-3">
                            <Label className="text-sm font-medium text-primary">Niveles de Ramas</Label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                              {producto.niveles.map((nivel, nivelIndex) => (
                                <div key={nivel.nivel} className="p-3 border rounded-lg bg-muted/30">
                                  <Label className="text-xs font-medium text-muted-foreground">
                                    Nivel {nivel.nivel} ({nivel.festones_por_rama} festones/rama)
                                  </Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={nivel.cantidad_ramas}
                                    onChange={(e) =>
                                      updateProductoNivel(index, nivelIndex, parseInt(e.target.value) || 0)
                                    }
                                    placeholder="Ramas"
                                    className="input-touch mt-1"
                                    inputMode="numeric"
                                  />
                                </div>
                              ))}
                            </div>

                            {/* Totales y % */}
                            {(() => {
                              const topeNav = getTopeForProduct(selectedProduct, formData.turno as string);
                              const pct = topeNav > 0 ? (producto.produccion_real / topeNav) * 100 : 0;
                              return (
                                <>
                                  <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                                    <span className="text-sm font-medium">Total de Festones:</span>
                                    <Badge variant="secondary" className="text-lg font-bold">
                                      {producto.produccion_real.toLocaleString()}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                                    <span className="text-sm font-medium">Cumplimiento:</span>
                                    <Badge variant="secondary" className="text-lg font-bold">
                                      {pct.toFixed(1)}%
                                    </Badge>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </>
                      ) : selectedProduct.tipo_producto === "arbol_amarradora" && producto.ramas_amarradora ? (
                        <>
                          {/* Ramas árbol amarradora */}
                          <div className="space-y-3">
                            <Label className="text-sm font-medium text-primary">Ramas del Árbol Amarradora</Label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                              {producto.ramas_amarradora.map((rama, ramaIndex) => (
                                <div key={rama.numero_rama} className="p-3 border rounded-lg bg-muted/30">
                                  <Label className="text-xs font-medium text-muted-foreground">
                                    Rama #{rama.numero_rama} (Tope: {rama.tope_rama})
                                  </Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={rama.cantidad_producida}
                                    onChange={(e) =>
                                      updateProductoRamaAmarradora(index, ramaIndex, parseInt(e.target.value) || 0)
                                    }
                                    placeholder="Cantidad"
                                    className="input-touch mt-1"
                                    inputMode="numeric"
                                  />
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {(() => {
                                      const factor = jornadaFactor(formData.turno as string);
                                      const topeEfectivo = rama.tope_rama * factor;
                                      const pct = topeEfectivo > 0 ? (rama.cantidad_producida / topeEfectivo) * 100 : 0;
                                      return `${pct.toFixed(1)}%`;
                                    })()}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                              <span className="text-sm font-medium">Promedio de Cumplimiento:</span>
                              {/* <Badge variant="secondary" className="text-lg font-bold">
                                {producto.produccion_real.toFixed(1)}%
                              </Badge> */}
                              <Badge variant="secondary" className="text-lg font-bold">
                                {calculatePromedioRamas(producto.ramas_amarradora, formData.turno as string).toFixed(1)}
                                %
                              </Badge>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Cantidad regular */}
                          <div className="flex-1">
                            <Label className="text-sm font-medium">Cantidad Producida</Label>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={producto.produccion_real}
                              onChange={(e) => updateProducto(index, "produccion_real", parseInt(e.target.value) || 0)}
                              placeholder="Unidades"
                              className="input-touch"
                              inputMode="numeric"
                            />
                          </div>
                        </>
                      )}

                      {/* Observaciones: solo con producto elegido */}
                      {selectedProduct && (
                        <div>
                          <Label className="text-sm font-medium">Observaciones</Label>
                          <Input
                            type="text"
                            value={producto.observaciones || ""}
                            onChange={(e) => updateProducto(index, "observaciones", e.target.value)}
                            placeholder="Anota cualquier observación necesaria..."
                            className="input-touch"
                          />
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Meta y Cumplimiento */}
            {formData.productos.filter((p) => !!p.producto_id).length > 0 && formData.turno && (
              <Card className="bg-muted/50 border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Target className="h-6 w-6 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">Resumen de Producción</p>
                        <div className="space-y-1">
                          {formData.productos
                            .filter((p) => !!p.producto_id)
                            .map((producto) => {
                              const productoInfo = productos.find((p) => p.id === producto.producto_id);
                              if (!productoInfo) return null;
                              const tope = getTopeForProduct(productoInfo, formData.turno as string);
                              return (
                                <div key={producto.producto_id} className="text-sm text-muted-foreground">
                                  <span className="font-medium">{productoInfo.nombre}:</span> {producto.produccion_real}{" "}
                                  / {tope} unidades
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>

                    {porcentajeCumplimiento > 0 && (
                      <div className="text-right">
                        <div className={`flex items-center space-x-2 ${getPerformanceColor(porcentajeCumplimiento)}`}>
                          {getPerformanceIcon(porcentajeCumplimiento)}
                          <span className="text-2xl font-bold">{porcentajeCumplimiento.toFixed(1)}%</span>
                        </div>
                        <Badge
                          className={
                            porcentajeCumplimiento >= 100
                              ? "bg-success text-success-foreground"
                              : porcentajeCumplimiento >= 80
                                ? "bg-primary text-primary-foreground"
                                : porcentajeCumplimiento >= 60
                                  ? "bg-warning text-warning-foreground"
                                  : "bg-destructive text-destructive-foreground"
                          }
                        >
                          {porcentajeCumplimiento >= 100
                            ? "Excelente"
                            : porcentajeCumplimiento >= 80
                              ? "Bueno"
                              : porcentajeCumplimiento >= 60
                                ? "Regular"
                                : "Por Mejorar"}
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Advertencia turno nocturno */}
            {formData.turno === "10:00pm - 6:00am" && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  El turno nocturno se registrará para el día siguiente automáticamente.
                </AlertDescription>
              </Alert>
            )}

            {/* Botón enviar */}
            <Button
              type="submit"
              className="w-full btn-touch text-lg font-semibold"
              disabled={
                loading ||
                !formData.turno ||
                !formData.maquina_id ||
                formData.productos.filter((p) => !!p.producto_id).length === 0
              }
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Guardando Registro...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Guardar Producción
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
