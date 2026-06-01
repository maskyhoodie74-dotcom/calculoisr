/**
 * ==========================================================================
 * CALCULADORA DE ISR MASIVA - LÓGICA DE NEGOCIO Y CONFIGURACIÓN DINÁMICA
 * ==========================================================================
 */

// 1. CONFIGURACIÓN INICIAL & DEFAULTS
const DEFAULT_SUPABASE_URL = "";
const DEFAULT_SUPABASE_KEY = "";

let supabaseUrl = localStorage.getItem("sb_url") || DEFAULT_SUPABASE_URL;
let supabaseKey = localStorage.getItem("sb_key") || DEFAULT_SUPABASE_KEY;
let supabaseClient = null;

// 2. TABLAS DE RETENCIÓN DE ISR (MÉXICO 2026 - OFICIALES SAT)
// Tabla Mensual
const ISR_TABLE_MONTHLY = [
  { limitInferior: 0.01, limitSuperior: 844.59, cuotaFija: 0.00, porcentaje: 1.92 },
  { limitInferior: 844.60, limitSuperior: 7168.51, cuotaFija: 16.22, porcentaje: 6.40 },
  { limitInferior: 7168.52, limitSuperior: 12598.02, cuotaFija: 420.95, porcentaje: 10.88 },
  { limitInferior: 12598.03, limitSuperior: 14644.64, cuotaFija: 1011.68, porcentaje: 16.00 },
  { limitInferior: 14644.65, limitSuperior: 17533.64, cuotaFija: 1339.14, porcentaje: 17.92 },
  { limitInferior: 17533.65, limitSuperior: 35362.83, cuotaFija: 1856.84, porcentaje: 21.36 },
  { limitInferior: 35362.84, limitSuperior: 55736.68, cuotaFija: 5665.16, porcentaje: 23.52 },
  { limitInferior: 55736.69, limitSuperior: 106410.50, cuotaFija: 10457.09, porcentaje: 30.00 },
  { limitInferior: 106410.51, limitSuperior: 141880.66, cuotaFija: 25659.23, porcentaje: 32.00 },
  { limitInferior: 141880.67, limitSuperior: 425641.99, cuotaFija: 37009.69, porcentaje: 34.00 },
  { limitInferior: 425642.00, limitSuperior: Infinity, cuotaFija: 133488.54, porcentaje: 35.00 }
];

// Tabla Quincenal
const ISR_TABLE_BIWEEKLY = [
  { limitInferior: 0.01, limitSuperior: 416.70, cuotaFija: 0.00, porcentaje: 1.92 },
  { limitInferior: 416.71, limitSuperior: 3537.15, cuotaFija: 7.95, porcentaje: 6.40 },
  { limitInferior: 3537.16, limitSuperior: 6216.15, cuotaFija: 207.75, porcentaje: 10.88 },
  { limitInferior: 6216.16, limitSuperior: 7225.95, cuotaFija: 499.20, porcentaje: 16.00 },
  { limitInferior: 7225.96, limitSuperior: 8651.40, cuotaFija: 660.75, porcentaje: 17.92 },
  { limitInferior: 8651.41, limitSuperior: 17448.75, cuotaFija: 916.20, porcentaje: 21.36 },
  { limitInferior: 17448.76, limitSuperior: 27501.60, cuotaFija: 2795.25, porcentaje: 23.52 },
  { limitInferior: 27501.61, limitSuperior: 52505.25, cuotaFija: 5159.70, porcentaje: 30.00 },
  { limitInferior: 52505.26, limitSuperior: 70006.95, cuotaFija: 12660.75, porcentaje: 32.00 },
  { limitInferior: 70006.96, limitSuperior: 210020.70, cuotaFija: 18261.30, porcentaje: 34.00 },
  { limitInferior: 210020.71, limitSuperior: Infinity, cuotaFija: 65866.05, porcentaje: 35.00 }
];

// Constantes para el "Subsidio para el Empleo" (Actualizado a 2026)
// Valor Diario UMA 2026 = $115.76 pesos
// UMA Mensual 2026 = $3,566.22 pesos
// Subsidio mensual 2026 = 15.02% de la UMA mensual = $536.22 pesos
// Límite salarial mensual para calificar = $11,492.66 pesos
const MONTHLY_UMA_2026 = 3566.22;
const SUBSIDIO_MENSUAL_2026 = 536.22;
const LIMITE_SUBSIDIO_MENSUAL = 11492.66;

// Subsidio Quincenal (Proporcional a 15 días: / 30.4 * 15)
const SUBSIDIO_QUINCENAL_2026 = 264.58;
const LIMITE_SUBSIDIO_QUINCENAL = 5670.72;

// 3. ESTADOS DE LA APLICACIÓN (STATE)
let employees = [];        // Datos en memoria
let currentSort = { column: 'name', asc: true };

// Instancias de Gráficos (ApexCharts)
let payrollDistributionChart = null;
let salaryRangesChart = null;

// 4. ELEMENTOS DEL DOM
const dbStatusBadge = document.getElementById("db-status-badge");
const dbStatusText = document.getElementById("db-status-text");
const themeToggle = document.getElementById("theme-toggle");
const employeesTableBody = document.getElementById("employees-table-body");
const emptyStateRow = document.getElementById("empty-state");
const employeeForm = document.getElementById("employee-form");
const excelFileInput = document.getElementById("excel-file-input");
const dropZone = document.getElementById("drop-zone");
const searchInput = document.getElementById("search-input");
const filterPeriod = document.getElementById("filter-period");
const exportExcelBtn = document.getElementById("export-excel-btn");
const clearAllBtn = document.getElementById("clear-all-btn");
const downloadTemplateBtn = document.getElementById("download-template-btn");
const toastContainer = document.getElementById("toast-container");
const employeesCountBadge = document.getElementById("employees-count-badge");
const showingText = document.getElementById("showing-text");
const syncStatusIndicator = document.getElementById("sync-status-indicator");
const syncText = document.getElementById("sync-text");

// Elementos de los Gráficos DOM
const toggleChartsBtn = document.getElementById("toggle-charts-btn");
const chartsPanel = document.getElementById("charts-panel");
const chartsGridContainer = document.getElementById("charts-grid-container");

// Elementos del Modal DOM
const calcModal = document.getElementById("calc-modal");
const closeModalBtn = document.getElementById("close-modal-btn");
const closeModalFooterBtn = document.getElementById("close-modal-footer-btn");

// Configuración Supabase DOM
const sbConfigCard = document.getElementById("supabase-config-card");
const sbToggleHeader = document.getElementById("supabase-toggle-header");
const sbUrlInput = document.getElementById("sb-url");
const sbKeyInput = document.getElementById("sb-key");
const saveConfigBtn = document.getElementById("save-config-btn");

// Métricas DOM
const statTotalEmployees = document.getElementById("stat-total-employees");
const statTotalGross = document.getElementById("stat-total-gross");
const statTotalIsr = document.getElementById("stat-total-isr");
const statTotalSubsidy = document.getElementById("stat-total-subsidy");
const statTotalNet = document.getElementById("stat-total-net");

// ==========================================================================
// TOAST NOTIFICATIONS SYSTEM (MICRO-FEEDBACK)
// ==========================================================================
function showToast(title, message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let iconName = "info";
  if (type === "success") iconName = "check-circle";
  if (type === "error") iconName = "alert-triangle";
  if (type === "warning") iconName = "alert-circle";

  toast.innerHTML = `
    <i data-lucide="${iconName}" class="toast-icon"></i>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;
  
  toastContainer.appendChild(toast);
  lucide.createIcons({ attrs: { class: 'toast-icon' } });

  // Animación de salida y remoción
  setTimeout(() => {
    toast.style.transform = "translateX(120%)";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ==========================================================================
// CÁLCULO CIENTÍFICO DE ISR Y SUBSIDIO (SAT DECRETO DE MAYO 2024)
// ==========================================================================
function calculateISR(grossSalary, period) {
  const table = period === "quincenal" ? ISR_TABLE_BIWEEKLY : ISR_TABLE_MONTHLY;
  const salary = parseFloat(grossSalary);
  
  if (isNaN(salary) || salary <= 0) {
    return { 
      gross: 0, 
      limitInferior: 0, 
      excedente: 0, 
      porcentaje: 0, 
      impuestoMarginal: 0, 
      cuotaFija: 0, 
      isrBruto: 0, 
      subsidio: 0, 
      isr: 0, 
      netSalary: 0 
    };
  }

  // Encontrar el renglón correcto por su límite superior e inferior
  let row = table.find(r => salary >= r.limitInferior && salary <= r.limitSuperior);
  
  // Si no se encuentra (por ejemplo si es mayor al último límite superior), tomamos el último
  if (!row) {
    row = table[table.length - 1];
  }

  // FÓRMULA SAT:
  // 1. Sueldo Bruto - Límite Inferior = Excedente
  // 2. Excedente * (% sobre excedente / 100) = Impuesto Marginal
  // 3. Impuesto Marginal + Cuota Fija = ISR Bruto (Impuesto de Tarifa)
  const excedente = salary - row.limitInferior;
  const impuestoMarginal = excedente * (row.porcentaje / 100);
  const isrBruto = impuestoMarginal + row.cuotaFija;
  
  // 4. Lógica de Subsidio para el Empleo (Decreto Mayo 2024)
  let subsidio = 0.00;
  if (period === "mensual") {
    if (salary <= LIMITE_SUBSIDIO_MENSUAL) {
      subsidio = SUBSIDIO_MENSUAL_2026;
    }
  } else {
    // Quincenal
    if (salary <= LIMITE_SUBSIDIO_QUINCENAL) {
      subsidio = SUBSIDIO_QUINCENAL_2026;
    }
  }

  // El subsidio solo disminuye el impuesto, no genera saldo a favor en efectivo bajo el nuevo decreto
  const isrNeto = Math.max(0, isrBruto - subsidio);
  
  // Redondeos a 2 decimales
  const roundedIsrBruto = Math.round(isrBruto * 100) / 100;
  const roundedIsr = Math.round(isrNeto * 100) / 100;
  const roundedSubsidio = Math.round(subsidio * 100) / 100;
  const netSalary = Math.round((salary - roundedIsr) * 100) / 100;

  return {
    gross: salary,
    limitInferior: row.limitInferior,
    excedente: Math.round(excedente * 100) / 100,
    porcentaje: row.porcentaje,
    impuestoMarginal: Math.round(impuestoMarginal * 100) / 100,
    cuotaFija: row.cuotaFija,
    isrBruto: roundedIsrBruto,
    subsidio: roundedSubsidio,
    isr: roundedIsr,
    netSalary: netSalary
  };
}

// ==========================================================================
// INTEGRACIÓN PREMIUM DE APEXCHARTS (DASHBOARD VISUAL)
// ==========================================================================
function initCharts() {
  // Gráfico 1: Distribución Monetaria de la Nómina (Donut)
  const donutOptions = {
    series: [0, 0, 0],
    labels: ['Sueldo Neto', 'ISR Retenido', 'Subsidio al Empleo'],
    chart: {
      type: 'donut',
      height: 280,
      fontFamily: 'Inter, sans-serif'
    },
    colors: ['#10b981', '#ef4444', '#fbbf24'],
    responsive: [{
      breakpoint: 480,
      options: {
        chart: { width: 200 },
        legend: { position: 'bottom' }
      }
    }],
    legend: {
      position: 'bottom',
      labels: { colors: 'var(--text-secondary)' }
    },
    dataLabels: {
      enabled: true,
      formatter: function (val, opts) {
        return opts.w.globals.series[opts.seriesIndex].toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
      }
    },
    tooltip: {
      y: {
        formatter: function (val) {
          return val.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) + ' MXN';
        }
      }
    }
  };

  // Gráfico 2: Distribución por Rangos Salariales (Columnas)
  const barOptions = {
    series: [{
      name: 'Empleados',
      data: [0, 0, 0, 0, 0]
    }],
    chart: {
      type: 'bar',
      height: 280,
      fontFamily: 'Inter, sans-serif',
      toolbar: { show: false }
    },
    plotOptions: {
      bar: {
        borderRadius: 6,
        columnWidth: '55%',
        distributed: true
      }
    },
    colors: ['#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e'],
    dataLabels: { enabled: false },
    legend: { show: false },
    xaxis: {
      categories: [
        '$0 - $8k',
        '$8k - $15k',
        '$15k - $30k',
        '$30k - $60k',
        '$60k+'
      ],
      labels: { style: { colors: 'var(--text-secondary)' } }
    },
    yaxis: {
      title: { 
        text: 'Nº de Empleados',
        style: { color: 'var(--text-secondary)' }
      },
      labels: { style: { colors: 'var(--text-secondary)' } }
    },
    grid: {
      borderColor: 'var(--border-color)',
      strokeDashArray: 4
    },
    tooltip: {
      y: {
        formatter: function (val) {
          return val + ' ' + (val === 1 ? 'Empleado' : 'Empleados');
        }
      }
    }
  };

  try {
    payrollDistributionChart = new ApexCharts(document.querySelector("#payroll-distribution-chart"), donutOptions);
    payrollDistributionChart.render();

    salaryRangesChart = new ApexCharts(document.querySelector("#salary-ranges-chart"), barOptions);
    salaryRangesChart.render();
  } catch (error) {
    console.error("Error al renderizar los gráficos:", error);
  }
}

function updateChartsData() {
  if (!payrollDistributionChart || !salaryRangesChart) return;

  const total = employees.length;
  if (total === 0) {
    // Si no hay datos, mostramos 0 en todo
    payrollDistributionChart.updateSeries([0, 0, 0]);
    salaryRangesChart.updateSeries([{ data: [0, 0, 0, 0, 0] }]);
    return;
  }

  // 1. Datos para Donut de Distribución Monetaria
  const netSum = employees.reduce((sum, emp) => sum + emp.net, 0);
  const isrSum = employees.reduce((sum, emp) => sum + emp.isr, 0);
  const subsidySum = employees.reduce((sum, emp) => sum + emp.subsidy, 0);

  payrollDistributionChart.updateSeries([
    Math.round(netSum * 100) / 100,
    Math.round(isrSum * 100) / 100,
    Math.round(subsidySum * 100) / 100
  ]);

  // 2. Datos para Bar de Rangos de Sueldo
  // Normalizamos a mensual para la comparación de rangos
  const ranges = [0, 0, 0, 0, 0]; // $0-$8k, $8k-$15k, $15k-$30k, $30k-$60k, $60k+
  
  employees.forEach(emp => {
    // Convertimos salario quincenal a mensual simulado para comparar peras con peras
    const monthlyEquivalent = emp.period === "quincenal" ? emp.gross * 2 : emp.gross;
    
    if (monthlyEquivalent <= 8000) {
      ranges[0]++;
    } else if (monthlyEquivalent <= 15000) {
      ranges[1]++;
    } else if (monthlyEquivalent <= 30000) {
      ranges[2]++;
    } else if (monthlyEquivalent <= 60000) {
      ranges[3]++;
    } else {
      ranges[4]++;
    }
  });

  salaryRangesChart.updateSeries([{
    name: 'Empleados',
    data: ranges
  }]);
}

// Toggle visual de los gráficos
toggleChartsBtn.addEventListener("click", () => {
  const isCollapsed = chartsPanel.classList.toggle("collapsed");
  localStorage.setItem("charts_panel_collapsed", isCollapsed ? "true" : "false");
  
  const icon = toggleChartsBtn.querySelector("i");
  icon.setAttribute("data-lucide", isCollapsed ? "eye" : "eye-off");
  toggleChartsBtn.innerHTML = isCollapsed 
    ? `<i data-lucide="eye"></i> Mostrar Gráficos` 
    : `<i data-lucide="eye-off"></i> Ocultar Gráficos`;
  
  lucide.createIcons();
});

// Cargar estado de gráficos colapsados
if (localStorage.getItem("charts_panel_collapsed") === "true") {
  chartsPanel.classList.add("collapsed");
  toggleChartsBtn.innerHTML = `<i data-lucide="eye"></i> Mostrar Gráficos`;
}

// ==========================================================================
// INTEGRACIÓN CON SUPABASE (PERSISTENCIA CLOUD)
// ==========================================================================
function initSupabase() {
  try {
    if (!supabaseUrl || !supabaseKey) {
      updateDbStatus(false, "Faltan credenciales");
      return;
    }
    
    // Inicializar cliente Supabase desde la CDN
    supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
    updateDbStatus(true, "Supabase Conectado");
    loadFromSupabase();
  } catch (error) {
    console.error("Error inicializando Supabase:", error);
    updateDbStatus(false, "Error de inicialización");
    showToast("Error Supabase", "No se pudo conectar a la base de datos", "error");
  }
}

function updateDbStatus(isConnected, text) {
  if (isConnected) {
    dbStatusBadge.className = "connection-badge status-connected";
    dbStatusText.textContent = text;
    syncStatusIndicator.className = "sync-status";
    syncText.textContent = "Sincronizado con Supabase";
  } else {
    dbStatusBadge.className = "connection-badge status-disconnected";
    dbStatusText.textContent = text;
    syncStatusIndicator.className = "sync-status sync-error";
    syncText.textContent = "Sin conexión a base de datos (Modo Local)";
  }
}

// Cargar registros desde Supabase
async function loadFromSupabase() {
  if (!supabaseClient) return;
  
  setSyncState(true, "Cargando datos...");
  injectSkeletons(); // Mostrar efecto de carga en la tabla
  
  try {
    const { data, error } = await supabaseClient
      .from("isr_records")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    
    employees = data.map(item => {
      // Si la base de datos no tiene subsidio calculado anteriormente, lo calculamos al vuelo
      const { isrBruto, subsidio } = calculateISR(item.gross_salary, item.period);
      
      return {
        id: item.id,
        name: item.name,
        period: item.period,
        gross: parseFloat(item.gross_salary),
        isr: parseFloat(item.isr),
        net: parseFloat(item.net_salary),
        // Datos extendidos locales para cálculos detallados
        isrBruto: isrBruto,
        subsidy: subsidio,
        created_at: item.created_at
      };
    });

    renderTable();
    updateDashboardMetrics();
    updateChartsData();
    setSyncState(false, "Datos actualizados");
    
    if (employees.length > 0) {
      showToast("Datos Sincronizados", `Se cargaron ${employees.length} empleados correctamente.`, "success");
    }
  } catch (err) {
    console.error("Error al cargar datos:", err);
    setSyncState(false, "Error al sincronizar", true);
    showToast("Error de Carga", "No se pudieron obtener los registros de Supabase. Revisa si creaste la tabla 'isr_records'.", "error");
    
    // Cargar vacía en caso de error para quitar skeletons
    employees = [];
    renderTable();
  }
}

// Guardar un registro en Supabase
async function saveToSupabase(employee) {
  if (!supabaseClient) return null;
  
  setSyncState(true, "Guardando registro...");
  try {
    const { data, error } = await supabaseClient
      .from("isr_records")
      .insert([
        {
          name: employee.name,
          period: employee.period,
          gross_salary: employee.gross,
          isr: employee.isr,
          net_salary: employee.net
        }
      ])
      .select();

    if (error) throw error;
    
    setSyncState(false, "Guardado en la nube");
    return data[0].id;
  } catch (err) {
    console.error("Error al guardar en Supabase:", err);
    setSyncState(false, "Error de guardado", true);
    showToast("Error al guardar", "Guardado localmente. La base de datos no respondió.", "warning");
    return null;
  }
}

// Guardar masivamente en Supabase (Batch insert de alta velocidad)
async function saveMultipleToSupabase(list) {
  if (!supabaseClient || list.length === 0) return;
  
  setSyncState(true, `Guardando ${list.length} registros...`);
  try {
    // Dividir la lista en lotes (de 50 registros) para evitar límites de payload
    const batchSize = 50;
    for (let i = 0; i < list.length; i += batchSize) {
      const batch = list.slice(i, i + batchSize).map(item => ({
        name: item.name,
        period: item.period,
        gross_salary: item.gross,
        isr: item.isr,
        net_salary: item.net
      }));
      
      const { error } = await supabaseClient
        .from("isr_records")
        .insert(batch);

      if (error) throw error;
    }
    
    setSyncState(false, "Sincronizado");
  } catch (err) {
    console.error("Error en inserción masiva:", err);
    setSyncState(false, "Error de sincronización masiva", true);
    showToast("Sincronización Fallida", "Se agregaron localmente, pero falló el envío masivo a Supabase.", "error");
  }
}

// Eliminar un registro en Supabase
async function deleteFromSupabase(id) {
  if (!supabaseClient || !id) return;
  
  setSyncState(true, "Eliminando registro...");
  try {
    const { error } = await supabaseClient
      .from("isr_records")
      .delete()
      .eq("id", id);

    if (error) throw error;
    
    setSyncState(false, "Eliminado de la nube");
  } catch (err) {
    console.error("Error al eliminar de Supabase:", err);
    setSyncState(false, "Error al eliminar", true);
  }
}

// Vaciar la tabla en Supabase
async function clearAllFromSupabase() {
  if (!supabaseClient) return;
  
  setSyncState(true, "Limpiando base de datos...");
  try {
    // Eliminación segura de toda la tabla
    const { error } = await supabaseClient
      .from("isr_records")
      .delete()
      .neq("name", "N/A"); // Elimina todo

    if (error) throw error;
    
    setSyncState(false, "Base de datos limpia");
    showToast("Base de datos limpia", "Se eliminaron todos los registros de la nube.", "success");
  } catch (err) {
    console.error("Error al vaciar Supabase:", err);
    setSyncState(false, "Error de limpieza", true);
  }
}

function setSyncState(isSyncing, text, isError = false) {
  if (isSyncing) {
    syncStatusIndicator.className = "sync-status syncing";
    syncText.textContent = text;
  } else {
    if (isError) {
      syncStatusIndicator.className = "sync-status sync-error";
    } else {
      syncStatusIndicator.className = "sync-status";
    }
    syncText.textContent = text;
  }
}

// Skeletons animadores de carga de tabla
function injectSkeletons() {
  employeesTableBody.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    const tr = document.createElement("tr");
    tr.className = "skeleton-row";
    tr.innerHTML = `
      <td colspan="6" style="padding: 18px 20px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="background:var(--border-color); height:16px; width:35%; border-radius:4px; animation: pulse-skel 1.5s infinite alternate;"></div>
          <div style="background:var(--border-color); height:16px; width:10%; border-radius:4px; animation: pulse-skel 1.5s infinite alternate;"></div>
          <div style="background:var(--border-color); height:16px; width:15%; border-radius:4px; animation: pulse-skel 1.5s infinite alternate;"></div>
          <div style="background:var(--border-color); height:16px; width:15%; border-radius:4px; animation: pulse-skel 1.5s infinite alternate;"></div>
          <div style="background:var(--border-color); height:16px; width:15%; border-radius:4px; animation: pulse-skel 1.5s infinite alternate;"></div>
        </div>
      </td>
    `;
    employeesTableBody.appendChild(tr);
  }
}

// Estilos de la animación CSS inyectados para skeletons
const skeletonStyles = document.createElement("style");
skeletonStyles.textContent = `
  @keyframes pulse-skel {
    0% { opacity: 0.5; }
    100% { opacity: 1; }
  }
`;
document.head.appendChild(skeletonStyles);

// ==========================================================================
// RENDERIZADO Y LÓGICA DE INTERFAZ DE TABLA
// ==========================================================================
function renderTable() {
  // Limpiar tbody
  employeesTableBody.innerHTML = "";
  
  // Aplicar filtros
  const query = searchInput.value.toLowerCase().trim();
  const period = filterPeriod.value;
  
  let filtered = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(query);
    const matchesPeriod = period === "all" || emp.period === period;
    return matchesSearch && matchesPeriod;
  });

  // Aplicar ordenamiento
  filtered.sort((a, b) => {
    let valA = a[currentSort.column];
    let valB = b[currentSort.column];
    
    if (typeof valA === 'string') {
      return currentSort.asc 
        ? valA.localeCompare(valB) 
        : valB.localeCompare(valA);
    } else {
      return currentSort.asc 
        ? valA - valB 
        : valB - valA;
    }
  });

  // Actualizar badges e info
  employeesCountBadge.textContent = `${employees.length} ${employees.length === 1 ? 'registro' : 'registros'}`;
  showingText.textContent = `Mostrando ${filtered.length} de ${employees.length} empleados`;

  if (filtered.length === 0) {
    employeesTableBody.appendChild(emptyStateRow);
    emptyStateRow.style.display = "table-row";
    
    // Si no hay datos en absoluto
    const emptyStateText = emptyStateRow.querySelector("p");
    const emptyStateTitle = emptyStateRow.querySelector("h3");
    if (employees.length > 0) {
      emptyStateTitle.textContent = "Sin resultados de búsqueda";
      emptyStateText.textContent = "Intenta buscar con otros términos o cambia el filtro de periodo.";
    } else {
      emptyStateTitle.textContent = "No hay registros";
      emptyStateText.textContent = "Agrega empleados individualmente, sube un Excel o haz clic en cualquier fila para ver el desglose matemático detallado.";
    }
    return;
  }
  
  emptyStateRow.style.display = "none";

  // Inyectar filas en el DOM de forma altamente eficiente
  const fragment = document.createDocumentFragment();
  
  filtered.forEach(emp => {
    const tr = document.createElement("tr");
    tr.id = `emp-row-${emp.id}`;
    
    tr.innerHTML = `
      <td class="col-name">${escapeHTML(emp.name)}</td>
      <td class="col-period">
        <span class="table-badge ${emp.period}">${emp.period}</span>
      </td>
      <td class="col-numeric bold-value">$${formatCurrency(emp.gross)}</td>
      <td class="col-numeric isr-value">$${formatCurrency(emp.isr)}</td>
      <td class="col-numeric net-value">$${formatCurrency(emp.net)}</td>
      <td class="col-actions">
        <button class="action-btn-delete" data-id="${emp.id}" aria-label="Eliminar empleado">
          <i data-lucide="trash"></i>
        </button>
      </td>
    `;
    
    // Al hacer clic en cualquier parte de la fila (menos en el botón de borrar) abrimos el modal de desglose detallado
    tr.addEventListener("click", (e) => {
      if (e.target.closest('.action-btn-delete')) return;
      openCalculationDetailModal(emp);
    });
    
    fragment.appendChild(tr);
  });
  
  employeesTableBody.appendChild(fragment);
  lucide.createIcons(); // inicializar iconos en las nuevas filas
  
  // Agregar eventos a botones de eliminación
  document.querySelectorAll(".action-btn-delete").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevenir que abra el modal al presionar eliminar
      const id = btn.getAttribute("data-id");
      deleteEmployee(id);
    });
  });
}

function updateDashboardMetrics() {
  const total = employees.length;
  
  const grossSum = employees.reduce((sum, emp) => sum + emp.gross, 0);
  const isrSum = employees.reduce((sum, emp) => sum + emp.isr, 0);
  const subsidySum = employees.reduce((sum, emp) => sum + emp.subsidy, 0);
  const netSum = employees.reduce((sum, emp) => sum + emp.net, 0);

  statTotalEmployees.textContent = total.toLocaleString();
  statTotalGross.textContent = `$${formatCurrency(grossSum)}`;
  statTotalIsr.textContent = `$${formatCurrency(isrSum)}`;
  statTotalSubsidy.textContent = `$${formatCurrency(subsidySum)}`;
  statTotalNet.textContent = `$${formatCurrency(netSum)}`;
}

// ==========================================================================
// MODAL DE DESGLOSE MATEMÁTICO SAT PASO A PASO
// ==========================================================================
function openCalculationDetailModal(employee) {
  // Realizar el cálculo detallado
  const math = calculateISR(employee.gross, employee.period);

  // Inyectar textos en el modal
  document.getElementById("modal-employee-name").textContent = employee.name;
  
  const periodBadge = document.getElementById("modal-employee-period");
  periodBadge.textContent = employee.period;
  periodBadge.className = `table-badge ${employee.period}`;

  document.getElementById("modal-employee-subtext").textContent = `ID de Registro: ${employee.id}`;

  // Llenar la hoja de operaciones matemáticas
  document.getElementById("desglose-bruto").textContent = `$${formatCurrency(math.gross)}`;
  document.getElementById("desglose-limite-inferior").textContent = `$${formatCurrency(math.limitInferior)}`;
  document.getElementById("desglose-excedente").textContent = `$${formatCurrency(math.excedente)}`;
  document.getElementById("desglose-porcentaje").textContent = `${math.porcentaje}%`;
  document.getElementById("desglose-impuesto-marginal").textContent = `$${formatCurrency(math.impuestoMarginal)}`;
  document.getElementById("desglose-cuota-fija").textContent = `$${formatCurrency(math.cuotaFija)}`;
  document.getElementById("desglose-isr-tarifa").textContent = `$${formatCurrency(math.isrBruto)}`;
  document.getElementById("desglose-subsidio").textContent = `$${formatCurrency(math.subsidio)}`;
  document.getElementById("desglose-isr-final").textContent = `$${formatCurrency(math.isr)}`;
  document.getElementById("desglose-neto").textContent = `$${formatCurrency(math.netSalary)}`;

  // Ocultar o mostrar renglón del subsidio si califica o no
  const subsidyRow = document.getElementById("subsidy-modal-row");
  if (math.subsidio > 0) {
    subsidyRow.style.display = "flex";
  } else {
    subsidyRow.style.display = "none";
  }

  // Activar animación y visualización
  calcModal.classList.add("active");
}

function closeCalculationDetailModal() {
  calcModal.classList.remove("active");
}

// Eventos de Cerrar el modal
closeModalBtn.addEventListener("click", closeCalculationDetailModal);
closeModalFooterBtn.addEventListener("click", closeCalculationDetailModal);
calcModal.addEventListener("click", (e) => {
  if (e.target === calcModal) {
    closeCalculationDetailModal();
  }
});

// ==========================================================================
// OPERACIONES SOBRE EMPLEADOS
// ==========================================================================
async function addEmployee(name, period, grossSalary) {
  const math = calculateISR(grossSalary, period);
  
  // Creamos un ID temporal por si no hay conexión a Supabase
  const tempId = 'temp-' + Date.now();
  const newEmployee = {
    id: tempId,
    name: name,
    period: period,
    gross: parseFloat(grossSalary),
    isr: math.isr,
    net: math.netSalary,
    // Datos extendidos locales para cálculos detallados
    isrBruto: math.isrBruto,
    subsidy: math.subsidio
  };

  // Añadir a estado local y renderizar para respuesta inmediata
  employees.unshift(newEmployee);
  renderTable();
  updateDashboardMetrics();
  updateChartsData();

  // Guardar en Supabase
  if (supabaseClient) {
    const realId = await saveToSupabase(newEmployee);
    if (realId) {
      newEmployee.id = realId;
      // Actualizar ID del botón en la fila creada
      const btn = document.querySelector(`[data-id="${tempId}"]`);
      if (btn) btn.setAttribute("data-id", realId);
      const tr = document.getElementById(`emp-row-${tempId}`);
      if (tr) tr.id = `emp-row-${realId}`;
    }
  }
  
  showToast("Empleado Agregado", `${name} agregado con éxito.`, "success");
}

async function deleteEmployee(id) {
  const index = employees.findIndex(emp => emp.id === id);
  if (index === -1) return;
  
  const empName = employees[index].name;
  
  // Eliminar localmente
  employees.splice(index, 1);
  renderTable();
  updateDashboardMetrics();
  updateChartsData();
  
  // Eliminar en Supabase
  if (supabase && !id.startsWith("temp-")) {
    await deleteFromSupabase(id);
  }
  
  showToast("Empleado Eliminado", `${empName} ha sido removido.`, "info");
}

// ==========================================================================
// IMPORTACIÓN DE ARCHIVOS EXCEL (SHEETJS & CONFETTI INTERACTION)
// ==========================================================================
function handleExcelImport(file) {
  const reader = new FileReader();
  
  setSyncState(true, "Leyendo archivo...");
  showToast("Procesando Excel", "Leyendo y calculando impuestos...", "info");
  
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      
      // Tomamos la primera hoja del libro
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      // Convertir a JSON matriz (fila por fila)
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      if (rows.length < 2) {
        showToast("Excel Vacío", "El archivo no contiene filas de datos válidas.", "warning");
        setSyncState(false, "Error de archivo", true);
        return;
      }

      const listToInsert = [];
      let skippedCount = 0;

      // Iterar desde el renglón 1 (ignorando la cabecera)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const name = row[0]?.toString().trim();
        const salaryVal = parseFloat(row[1]);
        let period = row[2]?.toString().toLowerCase().trim();
        
        // Validaciones básicas
        if (!name || isNaN(salaryVal) || salaryVal <= 0) {
          skippedCount++;
          continue;
        }

        // Normalizar periodo (mensual por defecto)
        if (period !== "quincenal") {
          period = "mensual";
        }

        const math = calculateISR(salaryVal, period);
        
        listToInsert.push({
          id: 'temp-' + Date.now() + '-' + i,
          name: name,
          period: period,
          gross: salaryVal,
          isr: math.isr,
          net: math.netSalary,
          isrBruto: math.isrBruto,
          subsidy: math.subsidio
        });
      }

      if (listToInsert.length === 0) {
        showToast("Error de Importación", "No se encontraron datos estructurados correctos en las columnas.", "error");
        setSyncState(false, "Error de estructura", true);
        return;
      }

      // Añadir al estado e interfaz local
      employees = [...listToInsert, ...employees];
      renderTable();
      updateDashboardMetrics();
      updateChartsData();

      // ¡DISPARAR ANIMACIÓN DE CONFETTI CELEBRATIVO!
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });

      showToast("Carga Masiva Exitosa", `Se procesaron ${listToInsert.length} empleados correctamente. (Omitidos: ${skippedCount})`, "success");
      
      // Guardar en Supabase
      if (supabaseClient) {
        await saveMultipleToSupabase(listToInsert);
        // Recargar datos oficiales para tener los IDs reales de Supabase
        await loadFromSupabase();
      }

    } catch (error) {
      console.error("Error parsing Excel:", error);
      showToast("Error al leer Excel", "Ocurrió un error leyendo el formato del archivo.", "error");
      setSyncState(false, "Error de parsing", true);
    }
  };
  
  reader.readAsArrayBuffer(file);
}

// Descargar plantilla
function downloadTemplateExcel() {
  const headers = [["Nombre Completo", "Sueldo Bruto", "Periodo"]];
  const sampleData = [
    ["Juan Pérez López", 15000, "mensual"],
    ["María Gómez Díaz", 4200, "quincenal"], // Califica para subsidio
    ["Carlos Ruiz Ortiz", 32000, "mensual"],
    ["Ana Martínez Pérez", 12000, "quincenal"]
  ];
  
  const worksheet = XLSX.utils.aoa_to_sheet(headers.concat(sampleData));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla");
  
  // Auto-ajustar anchos de columnas
  worksheet["!cols"] = [
    { wch: 25 },
    { wch: 15 },
    { wch: 15 }
  ];

  XLSX.writeFile(workbook, "Plantilla_Calculo_ISR.xlsx");
  showToast("Plantilla Descargada", "Usa este archivo para estructurar tu carga masiva.", "success");
}

// ==========================================================================
// EXPORTACIÓN A EXCEL DE RESULTADOS (SHEETJS)
// ==========================================================================
function exportResultsToExcel() {
  if (employees.length === 0) {
    showToast("Sin Datos", "No hay empleados registrados para exportar.", "warning");
    return;
  }

  showToast("Generando Excel", "Preparando reporte de nómina...", "info");

  // Estructurar el reporte detallado con Subsidios y Desgloses
  const reportData = employees.map(emp => {
    // Calculamos el desglose
    const math = calculateISR(emp.gross, emp.period);
    
    return {
      "Nombre del Empleado": emp.name,
      "Periodo de Retención": emp.period.charAt(0).toUpperCase() + emp.period.slice(1),
      "Sueldo Bruto (MXN)": emp.gross,
      "Límite Inferior SAT (MXN)": math.limitInferior,
      "Excedente de Límite (MXN)": math.excedente,
      "Porcentaje Aplicable (%)": math.porcentaje / 100, // Excel lo formatea como porcentaje
      "Impuesto Marginal (MXN)": math.impuestoMarginal,
      "Cuota Fija SAT (MXN)": math.cuotaFija,
      "ISR de Tarifa Bruto (MXN)": math.isrBruto,
      "Subsidio para el Empleo (MXN)": math.subsidio,
      "ISR Neto Retenido (MXN)": emp.isr,
      "Sueldo Neto Recibido (MXN)": emp.net
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(reportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Cálculos ISR");

  // Ajustes de formato de anchos de columnas para lectura fluida
  worksheet["!cols"] = [
    { wch: 28 }, // Nombre
    { wch: 16 }, // Periodo
    { wch: 16 }, // Bruto
    { wch: 18 }, // Lim inferior
    { wch: 18 }, // Excedente
    { wch: 18 }, // Porcentaje
    { wch: 18 }, // marginal
    { wch: 16 }, // cuota fija
    { wch: 18 }, // ISR bruto
    { wch: 20 }, // subsidio
    { wch: 18 }, // ISR final
    { wch: 18 }  // Neto
  ];

  // Aplicar formato de moneda y porcentajes a las celdas en SheetJS
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  for (let R = 1; R <= range.e.r; ++R) {
    // Porcentaje en columna F (índice 5)
    const pctCell = worksheet[XLSX.utils.encode_cell({ r: R, c: 5 })];
    if (pctCell) pctCell.z = '0.00%';
    
    // Formato de moneda en las demás columnas numéricas (A=0, B=1, C=2...)
    const colsMoneda = [2, 3, 4, 6, 7, 8, 9, 10, 11];
    colsMoneda.forEach(col => {
      const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: col })];
      if (cell) cell.z = '$#,##0.00';
    });
  }

  // Guardar archivo
  XLSX.writeFile(workbook, "Reporte_Retenciones_ISR_Completo.xlsx");
  showToast("Reporte Descargado", `Se exportaron ${employees.length} registros detallados a Excel.`, "success");
}

// ==========================================================================
// EVENT LISTENERS & CONFIG DE INTERFAZ
// ==========================================================================
function setupEventListeners() {
  // 1. Manejo del Cambio de Tema (Oscuro / Claro)
  themeToggle.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark-theme");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    
    // Cambiar icono de Lucide dinámicamente
    const icon = themeToggle.querySelector("i");
    icon.setAttribute("data-lucide", isDark ? "sun" : "moon");
    lucide.createIcons();
  });

  // Cargar tema guardado
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-theme");
    themeToggle.querySelector("i").setAttribute("data-lucide", "sun");
    lucide.createIcons();
  }

  // 2. Manejo de Pestañas (Single vs Bulk)
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      
      btn.classList.add("active");
      const tabId = btn.getAttribute("data-tab");
      document.getElementById(tabId).classList.add("active");
    });
  });

  // 3. Formulario Empleado Individual
  employeeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const nameInput = document.getElementById("emp-name");
    const salaryInput = document.getElementById("emp-salary");
    const periodInput = document.getElementById("emp-period");

    const name = nameInput.value.trim();
    const salary = parseFloat(salaryInput.value);
    const period = periodInput.value;

    if (!name || isNaN(salary) || salary <= 0) {
      showToast("Error de Validación", "Por favor ingresa datos correctos.", "warning");
      return;
    }

    addEmployee(name, period, salary);
    
    // Resetear formulario
    nameInput.value = "";
    salaryInput.value = "";
    nameInput.focus();
  });

  // 4. Carga Masiva Drag & Drop
  dropZone.addEventListener("click", () => excelFileInput.click());
  
  excelFileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleExcelImport(e.target.files[0]);
    }
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) {
      handleExcelImport(e.dataTransfer.files[0]);
    }
  });

  downloadTemplateBtn.addEventListener("click", downloadTemplateExcel);

  // 5. Configuración Supabase (Desplegable)
  sbToggleHeader.addEventListener("click", () => {
    sbConfigCard.classList.toggle("collapsed");
  });

  // Cargar inputs con la config guardada
  sbUrlInput.value = supabaseUrl;
  sbKeyInput.value = supabaseKey;

  saveConfigBtn.addEventListener("click", () => {
    const url = sbUrlInput.value.trim();
    const key = sbKeyInput.value.trim();

    if (!url || !key) {
      showToast("Credenciales Vacías", "Por favor introduce valores de URL y Key válidos.", "warning");
      return;
    }

    supabaseUrl = url;
    supabaseKey = key;
    localStorage.setItem("sb_url", url);
    localStorage.setItem("sb_key", key);

    showToast("Configuración Guardada", "Intentando conectar con las nuevas credenciales...", "info");
    initSupabase();
    sbConfigCard.classList.add("collapsed");
  });

  // 6. Barra de Búsqueda y Filtros
  searchInput.addEventListener("input", renderTable);
  filterPeriod.addEventListener("change", renderTable);

  // 7. Exportación e Limpieza General
  exportExcelBtn.addEventListener("click", exportResultsToExcel);
  
  clearAllBtn.addEventListener("click", async () => {
    if (employees.length === 0) return;
    
    const confirmClear = confirm("¿Estás seguro de que deseas eliminar TODOS los empleados de la lista? Esto vaciará la base de datos.");
    if (!confirmClear) return;

    employees = [];
    renderTable();
    updateDashboardMetrics();
    updateChartsData();

    if (supabaseClient) {
      await clearAllFromSupabase();
    }
    
    showToast("Datos Eliminados", "Se borraron todos los registros locales y en la nube.", "info");
  });

  // 8. Ordenamiento de Columnas
  document.querySelectorAll(".employees-table th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const field = th.getAttribute("data-sort");
      
      if (currentSort.column === field) {
        currentSort.asc = !currentSort.asc;
      } else {
        currentSort.column = field;
        currentSort.asc = true;
      }

      // Actualizar dirección visual en los th
      document.querySelectorAll(".employees-table th i").forEach(icon => {
        icon.setAttribute("data-lucide", "chevrons-up-down");
      });

      const activeIcon = th.querySelector("i");
      activeIcon.setAttribute("data-lucide", currentSort.asc ? "chevron-up" : "chevron-down");
      lucide.createIcons();

      renderTable();
    });
  });
}

// ==========================================================================
// UTILERÍAS & AUXILIARES DE NÚMEROS Y MONEDAS
// ==========================================================================
function formatCurrency(value) {
  return value.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// ==========================================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  // 1. Inicializar Iconos de Lucide
  lucide.createIcons();
  
  // 2. Configurar Escuchadores de Eventos del DOM
  setupEventListeners();
  
  // 3. Inicializar los Gráficos Interactivos (ApexCharts)
  initCharts();
  
  // 4. Conectar y Sincronizar Base de Datos Supabase
  initSupabase();
  
  // Renderizado inicial en memoria (vacío en lo que responde Supabase)
  renderTable();
  updateDashboardMetrics();
  updateChartsData();
});
