let certChartInstance = null;
let statusChartInstance = null;
let currentRequestsPage = 1;
let currentRequestsLimit = 10;
let totalRequestsPages = 1;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Authentication Check
  const token = localStorage.getItem('admin_token');
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

  try {
    const authRes = await fetch('/api/admin/me', { headers });
    if (!authRes.ok) {
      window.location.href = '/admin/login';
      return;
    }
    const authData = await authRes.json();
    if (authData.admin) {
      document.getElementById('adminFullName').textContent = authData.admin.fullName;
      document.getElementById('adminRole').textContent = authData.admin.role;
    }
  } catch (err) {
    console.error('Auth verification error:', err);
    window.location.href = '/admin/login';
    return;
  }

  // 2. Logout Button
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST', headers });
    } catch {}
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    window.location.href = '/admin/login';
  });

  // 3. Tab Switching
  const tabBtnOverview = document.getElementById('tabBtnOverview');
  const tabBtnRequests = document.getElementById('tabBtnRequests');
  const tabBtnSms = document.getElementById('tabBtnSms');
  const tabContentOverview = document.getElementById('tabContentOverview');
  const tabContentRequests = document.getElementById('tabContentRequests');
  const tabContentSms = document.getElementById('tabContentSms');

  function setTab(activeTab) {
    [tabBtnOverview, tabBtnRequests, tabBtnSms].forEach(btn => {
      btn.classList.remove('border-phblue', 'text-phblue');
      btn.classList.add('border-transparent', 'text-slate-500');
    });

    [tabContentOverview, tabContentRequests, tabContentSms].forEach(content => {
      content.classList.add('hidden');
    });

    if (activeTab === 'overview') {
      tabBtnOverview.classList.add('border-phblue', 'text-phblue');
      tabBtnOverview.classList.remove('border-transparent', 'text-slate-500');
      tabContentOverview.classList.remove('hidden');
      loadOverviewMetrics();
    } else if (activeTab === 'requests') {
      tabBtnRequests.classList.add('border-phblue', 'text-phblue');
      tabBtnRequests.classList.remove('border-transparent', 'text-slate-500');
      tabContentRequests.classList.remove('hidden');
      loadRequests();
    } else if (activeTab === 'sms') {
      tabBtnSms.classList.add('border-phblue', 'text-phblue');
      tabBtnSms.classList.remove('border-transparent', 'text-slate-500');
      tabContentSms.classList.remove('hidden');
      loadSmsLogs();
    }
  }

  tabBtnOverview.addEventListener('click', () => setTab('overview'));
  tabBtnRequests.addEventListener('click', () => setTab('requests'));
  tabBtnSms.addEventListener('click', () => setTab('sms'));

  window.switchToRequestsTab = (statusFilter = null) => {
    if (statusFilter) {
      document.getElementById('filterStatus').value = statusFilter;
    }
    setTab('requests');
  };

  // 4. Initial Load
  loadOverviewMetrics();

  // 5. Filters & Search in Requests Tab
  const searchInput = document.getElementById('searchInput');
  const filterStatus = document.getElementById('filterStatus');
  const filterCertType = document.getElementById('filterCertType');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');

  let searchTimeout = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentRequestsPage = 1;
      loadRequests();
    }, 300);
  });

  filterStatus.addEventListener('change', () => {
    currentRequestsPage = 1;
    loadRequests();
  });

  filterCertType.addEventListener('change', () => {
    currentRequestsPage = 1;
    loadRequests();
  });

  resetFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    filterStatus.value = 'All';
    filterCertType.value = 'All';
    currentRequestsPage = 1;
    loadRequests();
  });

  // Pagination buttons
  document.getElementById('prevPageBtn').addEventListener('click', () => {
    if (currentRequestsPage > 1) {
      currentRequestsPage--;
      loadRequests();
    }
  });

  document.getElementById('nextPageBtn').addEventListener('click', () => {
    if (currentRequestsPage < totalRequestsPages) {
      currentRequestsPage++;
      loadRequests();
    }
  });

  // 6. Status Update Modal Form
  const statusUpdateForm = document.getElementById('statusUpdateForm');
  const newStatusSelect = document.getElementById('newStatusSelect');
  const statusRemarks = document.getElementById('statusRemarks');
  const smsPreviewBox = document.getElementById('smsPreviewBox');

  function updateSmsPreview() {
    const status = newStatusSelect.value;
    const name = document.getElementById('statusUpdateReqName').value || 'Resident';
    const cert = document.getElementById('statusUpdateReqCert').value || 'Certificate';
    const control = document.getElementById('statusModalControlNo').textContent || 'BC-XXXX';
    const remarks = statusRemarks.value.trim();

    if (status === 'Ready for Pickup') {
      let msg = `Maayong adlaw ${name}! Andam na alang sa pickup ang imong ${cert} (${control}) sa Barangay Concepcion Hall. Palihug dala ug valid ID ug CTC.`;
      if (remarks) msg += ` Note: ${remarks}`;
      msg += ` Office hours: 8AM-5PM (Mon-Fri). Salamat!`;
      smsPreviewBox.textContent = `"${msg}"`;
    } else if (status === 'Processing') {
      smsPreviewBox.textContent = `"Maayong adlaw ${name}! Gisugdan na ang pagproseso sa imong ${cert} (${control}) sa Barangay Concepcion. Salamat sa paghulat!"`;
    } else if (status === 'Released') {
      smsPreviewBox.textContent = `"Maayong adlaw ${name}! Malampusong na-release ang imong ${cert} (${control}). Daghang salamat sa imong kooperasyon! - Brgy. Concepcion"`;
    } else if (status === 'Rejected') {
      smsPreviewBox.textContent = `"Maayong adlaw ${name}! Ang imong request para sa ${cert} (${control}) wala ma-aprobahan. Rason: ${remarks || 'Palihug bisitaha ang Barangay Hall'}. - Brgy. Concepcion"`;
    } else {
      smsPreviewBox.textContent = `"Maayong adlaw ${name}! Nadawat ang imong request para sa ${cert}. Imong Control No: ${control}. - Brgy. Concepcion"`;
    }
  }

  newStatusSelect.addEventListener('change', updateSmsPreview);
  statusRemarks.addEventListener('input', updateSmsPreview);

  statusUpdateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const reqId = document.getElementById('statusUpdateReqId').value;
    const status = newStatusSelect.value;
    const remarks = statusRemarks.value.trim();
    const sendSmsAlert = document.getElementById('sendSmsCheckbox').checked;
    const currentToken = localStorage.getItem('admin_token') || token;

    const saveBtn = document.getElementById('saveStatusBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Saving...';

    try {
      const res = await fetch(`/api/admin/requests/${reqId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify({ status, remarks, sendSmsAlert })
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        alert(resData.message || 'Failed to update status.');
        return;
      }

      alert(`✅ Success: Request status updated to "${status}".`);
      closeStatusModal();
      loadRequests();
      loadOverviewMetrics();
    } catch (err) {
      console.error('Status update error:', err);
      alert('Network or server error while updating status.');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<span>Save & Notify Resident</span> <i class="fa-solid fa-paper-plane text-[10px]"></i>';
    }
  });

  // 7. Manual SMS Modal Form
  const manualSmsForm = document.getElementById('manualSmsForm');
  const smsTemplateSelect = document.getElementById('smsTemplateSelect');
  const manualSmsMessage = document.getElementById('manualSmsMessage');
  const charCount = document.getElementById('charCount');

  manualSmsMessage.addEventListener('input', () => {
    charCount.textContent = `${manualSmsMessage.value.length} characters`;
  });

  smsTemplateSelect.addEventListener('change', () => {
    const val = smsTemplateSelect.value;
    if (val === 'ready') {
      manualSmsMessage.value = 'Maayong adlaw! Andam na alang sa pickup ang imong certificate sa Barangay Concepcion Hall. Office hours: 8AM-5PM (Mon-Fri). Palihug pagdala ug valid ID. Salamat!';
    } else if (val === 'missing_id') {
      manualSmsMessage.value = 'Maayong adlaw gikan sa Barangay Concepcion! Adunay kakuwangon sa imong dokumento (Valid ID). Palihug pagdala ug kopya sa Barangay Hall aron mapadayon ang pagproseso. Salamat!';
    } else if (val === 'cedula') {
      manualSmsMessage.value = 'Pahibalo gikan sa Barangay Concepcion: Palihug andama ang imong Cedula (Community Tax Certificate) sa pag-claim sa imong requested certificate. Salamat!';
    } else if (val === 'office_closing') {
      manualSmsMessage.value = 'Pahibalo: Ang Barangay Concepcion Hall bukas gikan Lunes hangtod Biyernes, 8:00 AM hangtod 5:00 PM. Daghang salamat!';
    }
    charCount.textContent = `${manualSmsMessage.value.length} characters`;
  });

  manualSmsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const recipient = document.getElementById('manualSmsRecipient').value.trim();
    const message = manualSmsMessage.value.trim();
    const reqId = document.getElementById('manualSmsReqId').value;

    const sendBtn = document.getElementById('sendManualSmsBtn');
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Sending...';

    try {
      const res = await fetch('/api/admin/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || token}`
        },
        body: JSON.stringify({ recipient, message, requestId: reqId })
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        alert(resData.message || 'Failed to dispatch SMS.');
        return;
      }

      alert('SMS successfully dispatched / logged!');
      closeManualSmsModal();
      if (!tabContentSms.classList.contains('hidden')) {
        loadSmsLogs();
      }
    } catch (err) {
      console.error('SMS sending error:', err);
      alert('Network error while dispatching SMS.');
    } finally {
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<span>Send SMS</span> <i class="fa-solid fa-paper-plane text-[10px]"></i>';
    }
  });
});

// ====================================================================
// OVERVIEW METRICS LOADER
// ====================================================================
async function loadOverviewMetrics() {
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch('/api/admin/overview', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;

    const json = await res.json();
    const data = json.data;

    // KPI Cards
    document.getElementById('kpiTotal').textContent = data.kpi.total;
    document.getElementById('kpiPending').textContent = data.kpi.pending;
    document.getElementById('kpiProcessing').textContent = data.kpi.processing;
    document.getElementById('kpiReady').textContent = data.kpi.readyForPickup;
    document.getElementById('kpiReleased').textContent = data.kpi.released;
    document.getElementById('kpiToday').textContent = data.kpi.today;
    document.getElementById('requestsCountBadge').textContent = data.kpi.total;

    // Render Charts
    renderCertTypeChart(data.certTypes || []);
    renderStatusChart(data.statusBreakdown || []);
  } catch (err) {
    console.error('Error fetching overview:', err);
  }
}

function renderCertTypeChart(certTypes) {
  const ctx = document.getElementById('certChart');
  if (!ctx) return;

  const labels = certTypes.map(c => c.cert_type);
  const values = certTypes.map(c => c.count);

  if (certChartInstance) {
    certChartInstance.destroy();
  }

  certChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['Barangay Clearance', 'Residency', 'Indigency'],
      datasets: [{
        label: 'Applications',
        data: values.length ? values : [0, 0, 0],
        backgroundColor: ['#0038A8', '#15803D', '#D97706'],
        borderRadius: 10,
        maxBarThickness: 56
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          padding: 12,
          boxPadding: 6,
          titleFont: { size: 13, weight: 'bold' },
          bodyFont: { size: 12 }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11, weight: 'bold' }, color: '#475569' }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(241, 245, 249, 0.9)' },
          ticks: { stepSize: 1, precision: 0, font: { size: 11, weight: '600' }, color: '#64748b' }
        }
      }
    }
  });
}

function renderStatusChart(statusBreakdown) {
  const ctx = document.getElementById('statusChart');
  if (!ctx) return;

  const labels = statusBreakdown.map(s => s.status);
  const values = statusBreakdown.map(s => s.count);

  if (statusChartInstance) {
    statusChartInstance.destroy();
  }

  const colorMap = {
    'Pending Review': '#F59E0B',
    'Processing': '#3B82F6',
    'Ready for Pickup': '#10B981',
    'Released': '#6366F1',
    'Rejected': '#EF4444'
  };

  const bgColors = labels.map(l => colorMap[l] || '#94A3B8');

  statusChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.length ? labels : ['Pending', 'Processing', 'Ready', 'Released'],
      datasets: [{
        data: values.length ? values : [1, 1, 1, 1],
        backgroundColor: bgColors.length ? bgColors : ['#F59E0B', '#3B82F6', '#10B981', '#6366F1'],
        borderWidth: 3,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 10,
            padding: 14,
            font: { size: 11, weight: 'bold' }
          }
        },
        tooltip: {
          padding: 12,
          boxPadding: 6,
          titleFont: { size: 13, weight: 'bold' },
          bodyFont: { size: 12 }
        }
      }
    }
  });
}

// ====================================================================
// REQUESTS TABLE LOADER
// ====================================================================
async function loadRequests() {
  const token = localStorage.getItem('admin_token');
  const search = document.getElementById('searchInput').value.trim();
  const status = document.getElementById('filterStatus').value;
  const certType = document.getElementById('filterCertType').value;

  const tableBody = document.getElementById('requestsTableBody');
  const tableLoading = document.getElementById('tableLoading');
  const tableEmpty = document.getElementById('tableEmpty');

  tableLoading.classList.remove('hidden');
  tableEmpty.classList.add('hidden');
  tableBody.innerHTML = '';

  try {
    const query = new URLSearchParams({
      page: currentRequestsPage,
      limit: currentRequestsLimit,
      search,
      status,
      certType
    });

    const res = await fetch(`/api/admin/requests?${query.toString()}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Failed to load requests');

    const json = await res.json();
    const requests = json.requests || [];
    const pagination = json.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 };

    totalRequestsPages = pagination.totalPages;

    // Update pagination indicators
    document.getElementById('paginationInfo').textContent = 
      pagination.total > 0
        ? `Showing ${(pagination.page - 1) * pagination.limit + 1} to ${Math.min(pagination.total, pagination.page * pagination.limit)} of ${pagination.total} entries`
        : 'Showing 0 entries';

    document.getElementById('pageIndicator').textContent = `Page ${pagination.page} of ${pagination.totalPages}`;
    document.getElementById('prevPageBtn').disabled = pagination.page <= 1;
    document.getElementById('nextPageBtn').disabled = pagination.page >= pagination.totalPages;

    tableLoading.classList.add('hidden');

    if (requests.length === 0) {
      tableEmpty.classList.remove('hidden');
      return;
    }

    requests.forEach(req => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-blue-50/40 transition-colors border-b border-slate-100';

      const applicantName = `${req.first_name} ${req.last_name}${req.suffix ? ' ' + req.suffix : ''}`;
      const dateObj = new Date(req.created_at);
      const dateFormatted = isNaN(dateObj) ? req.created_at : dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      // Status Badge Color & Dot
      let statusBadgeClass = 'bg-slate-100 text-slate-700 border border-slate-200';
      let statusDot = 'bg-slate-400';
      if (req.status === 'Ready for Pickup') {
        statusBadgeClass = 'bg-emerald-50 text-emerald-800 border border-emerald-200';
        statusDot = 'bg-emerald-500';
      } else if (req.status === 'Processing') {
        statusBadgeClass = 'bg-blue-50 text-phblue border border-blue-200';
        statusDot = 'bg-blue-500';
      } else if (req.status === 'Released') {
        statusBadgeClass = 'bg-indigo-50 text-indigo-800 border border-indigo-200';
        statusDot = 'bg-indigo-500';
      } else if (req.status === 'Rejected') {
        statusBadgeClass = 'bg-red-50 text-red-800 border border-red-200';
        statusDot = 'bg-red-500';
      } else if (req.status === 'Pending Review') {
        statusBadgeClass = 'bg-amber-50 text-amber-800 border border-amber-200';
        statusDot = 'bg-amber-500';
      }

      // Certificate Type Badge
      let certBadge = 'bg-blue-50 text-phblue border border-blue-200';
      let certIcon = 'fa-file-shield';
      if (req.cert_type === 'Certificate of Residency') {
        certBadge = 'bg-amber-50 text-amber-800 border border-amber-200';
        certIcon = 'fa-house-user';
      } else if (req.cert_type === 'Certificate of Indigency') {
        certBadge = 'bg-emerald-50 text-emerald-800 border border-emerald-200';
        certIcon = 'fa-hand-holding-heart';
      }

      tr.innerHTML = `
        <td class="px-6 py-4 font-mono font-bold text-phblue whitespace-nowrap">
          <a href="/track?ref=${encodeURIComponent(req.control_number)}" target="_blank" class="hover:underline flex items-center space-x-1.5 group">
            <span class="group-hover:text-blue-800">${req.control_number}</span>
            <i class="fa-solid fa-arrow-up-right-from-square text-[10px] text-slate-400 group-hover:text-phblue"></i>
          </a>
        </td>
        <td class="px-6 py-4 font-bold text-slate-900 whitespace-nowrap">${applicantName}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold ${certBadge}">
            <i class="fa-solid ${certIcon} text-[10px]"></i>
            ${req.cert_type}
          </span>
        </td>
        <td class="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">${req.purok}</td>
        <td class="px-6 py-4 font-mono font-medium text-slate-700 whitespace-nowrap">${req.contact_number}</td>
        <td class="px-6 py-4 text-slate-500 font-medium whitespace-nowrap">${dateFormatted}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold ${statusBadgeClass}">
            <span class="w-1.5 h-1.5 rounded-full ${statusDot}"></span>
            ${req.status}
          </span>
        </td>
        <td class="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
          <button type="button" class="btn-action-view px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-2xs hover:shadow-xs inline-flex items-center gap-1" title="View Details">
            <i class="fa-solid fa-eye text-slate-500"></i>
            <span class="hidden xl:inline">View</span>
          </button>
          <button type="button" class="btn-action-status px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-phblue rounded-xl text-xs font-bold border border-blue-200 transition-all shadow-2xs hover:shadow-xs inline-flex items-center gap-1" title="Update Status">
            <i class="fa-solid fa-pen-to-square"></i>
            <span class="hidden xl:inline">Status</span>
          </button>
          <button type="button" class="btn-action-sms px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 transition-all shadow-2xs hover:shadow-xs inline-flex items-center gap-1" title="Send SMS">
            <i class="fa-solid fa-comment-sms"></i>
            <span class="hidden xl:inline">SMS</span>
          </button>
          <a href="/admin/print/${encodeURIComponent(req.control_number)}" target="_blank" title="Print Official Certificate"
            class="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold border border-amber-200 transition-all shadow-2xs hover:shadow-xs inline-flex items-center gap-1">
            <i class="fa-solid fa-print"></i>
            <span class="hidden xl:inline">Print</span>
          </a>
        </td>
      `;

      // Attach direct event listeners to guarantee 100% reliable execution with string control numbers
      tr.querySelector('.btn-action-view').addEventListener('click', () => {
        openViewModal(req.id || req.control_number);
      });
      tr.querySelector('.btn-action-status').addEventListener('click', () => {
        openStatusModal(
          req.id || req.control_number,
          req.control_number,
          req.status,
          req.admin_remarks || '',
          req.contact_number,
          applicantName,
          req.cert_type
        );
      });
      tr.querySelector('.btn-action-sms').addEventListener('click', () => {
        openManualSmsModal(
          req.id || req.control_number,
          req.contact_number,
          applicantName,
          req.cert_type
        );
      });

      tableBody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading requests:', err);
    tableLoading.classList.add('hidden');
    tableEmpty.classList.remove('hidden');
  }
}

// ====================================================================
// MODAL CONTROLS
// ====================================================================

// 1. View Details Modal
window.openViewModal = async (id) => {
  const token = localStorage.getItem('admin_token');
  const modal = document.getElementById('viewModal');

  try {
    const res = await fetch(`/api/admin/requests/${encodeURIComponent(id)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      alert(json.message || 'Failed to load request details.');
      return;
    }

    const { request: req, statusLogs } = json.data;
    const applicantName = `${req.first_name} ${req.middle_name ? req.middle_name + ' ' : ''}${req.last_name}${req.suffix ? ' ' + req.suffix : ''}`;

    document.getElementById('modalReqControlNo').textContent = req.control_number;
    document.getElementById('modalReqFullName').textContent = applicantName;
    document.getElementById('modalReqCertType').textContent = req.cert_type;
    document.getElementById('modalReqStatus').textContent = req.status;
    document.getElementById('modalReqPurok').textContent = req.purok;
    document.getElementById('modalReqContact').textContent = req.contact_number;
    const emailElem = document.getElementById('modalReqEmail');
    if (emailElem) emailElem.textContent = req.email || 'None Provided';
    document.getElementById('modalReqResidency').textContent = `${req.years_of_residency} Year(s)`;
    document.getElementById('modalReqCedula').textContent = req.cedula_no || 'None Provided';
    document.getElementById('modalReqCivil').textContent = `${req.civil_status} / ${req.gender}`;
    document.getElementById('modalReqBirth').textContent = req.birth_date;
    document.getElementById('modalReqPurpose').textContent = req.purpose;
    document.getElementById('modalReqRemarks').textContent = req.admin_remarks || 'None';
    document.getElementById('modalPrintLink').href = `/admin/print/${encodeURIComponent(req.control_number)}`;

    // Wire up Update Status button from inside the View modal
    const updateBtn = document.getElementById('modalUpdateStatusBtn');
    if (updateBtn) {
      updateBtn.onclick = () => {
        closeViewModal();
        openStatusModal(
          req.id || req.control_number,
          req.control_number,
          req.status,
          req.admin_remarks || '',
          req.contact_number,
          applicantName,
          req.cert_type
        );
      };
    }

    // Valid ID Preview
    const idContainer = document.getElementById('modalIdContainer');
    if (req.valid_id_path) {
      const isPdf = req.valid_id_path.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        idContainer.innerHTML = `
          <div class="flex items-center space-x-2">
            <i class="fa-solid fa-file-pdf text-red-600 text-lg"></i>
            <a href="${req.valid_id_path}" target="_blank" class="font-bold text-phblue hover:underline">
              View Uploaded PDF Document <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
            </a>
          </div>
        `;
      } else {
        idContainer.innerHTML = `
          <div>
            <a href="${req.valid_id_path}" target="_blank">
              <img src="${req.valid_id_path}" alt="Valid ID" class="max-h-48 rounded-lg border border-slate-200 object-contain hover:opacity-90 transition-opacity">
            </a>
            <div class="text-[10px] text-slate-500 mt-1">Click image to inspect full size in new tab.</div>
          </div>
        `;
      }
    } else {
      idContainer.innerHTML = '<span class="text-slate-400 italic">No valid ID was attached to this request.</span>';
    }

    // Status Logs
    const logsContainer = document.getElementById('modalStatusLogs');
    logsContainer.innerHTML = '';
    (statusLogs || []).forEach(log => {
      const logDiv = document.createElement('div');
      logDiv.className = 'text-xs p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center';
      logDiv.innerHTML = `
        <div>
          <span class="font-bold text-slate-800">${log.new_status}</span>
          <span class="text-slate-500 text-[11px] ml-2">"${log.remarks || ''}"</span>
        </div>
        <div class="text-[10px] text-slate-400 font-mono">${log.changed_by} • ${new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      `;
      logsContainer.appendChild(logDiv);
    });

    modal.classList.remove('hidden');
  } catch (err) {
    console.error('View modal load error:', err);
  }
};

window.closeViewModal = () => {
  document.getElementById('viewModal').classList.add('hidden');
};

// 2. Status Modal
window.openStatusModal = (id, controlNo, currentStatus, currentRemarks, contact, name, certType) => {
  document.getElementById('statusUpdateReqId').value = id;
  document.getElementById('statusModalControlNo').textContent = controlNo;
  document.getElementById('statusUpdateReqPhone').value = contact;
  document.getElementById('statusUpdateReqName').value = name;
  document.getElementById('statusUpdateReqCert').value = certType;
  document.getElementById('newStatusSelect').value = currentStatus;
  document.getElementById('statusRemarks').value = currentRemarks || '';

  // Trigger preview update
  document.getElementById('newStatusSelect').dispatchEvent(new Event('change'));
  document.getElementById('statusModal').classList.remove('hidden');
};

window.closeStatusModal = () => {
  document.getElementById('statusModal').classList.add('hidden');
};

// 3. Manual SMS Modal
window.openManualSmsModal = (id, contact, name, certType) => {
  document.getElementById('manualSmsReqId').value = id;
  document.getElementById('manualSmsRecipient').value = contact;
  document.getElementById('smsTemplateSelect').value = '';
  document.getElementById('manualSmsMessage').value = `Maayong adlaw ${name}! Pahibalo kabahin sa imong ${certType} sa Barangay Concepcion: `;
  document.getElementById('charCount').textContent = `${document.getElementById('manualSmsMessage').value.length} characters`;
  document.getElementById('manualSmsModal').classList.remove('hidden');
};

window.closeManualSmsModal = () => {
  document.getElementById('manualSmsModal').classList.add('hidden');
};

// ====================================================================
// NOTIFICATION LOGS TABLE LOADER (RESEND EMAIL + SMS)
// ====================================================================
async function loadSmsLogs() {
  const token = localStorage.getItem('admin_token');
  const tableBody = document.getElementById('smsLogsTableBody');
  tableBody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-400"><i class="fa-solid fa-circle-notch fa-spin text-xl text-phblue"></i></td></tr>';

  try {
    const [smsRes, emailRes] = await Promise.all([
      fetch('/api/admin/sms-logs', { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null),
      fetch('/api/admin/email-logs', { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null)
    ]);

    const smsData = (smsRes && smsRes.ok) ? await smsRes.json() : { logs: [] };
    const emailData = (emailRes && emailRes.ok) ? await emailRes.json() : { logs: [] };

    // Format SMS logs
    const formattedSms = (smsData.logs || []).map(l => ({
      id: l.id,
      channel: 'SMS',
      recipient: l.recipient_number,
      name: l.first_name ? `${l.first_name} ${l.last_name}` : 'Applicant',
      control_number: l.control_number || 'N/A',
      message: l.message,
      status: l.status,
      created_at: l.created_at
    }));

    // Format Email logs
    const formattedEmail = (emailData.logs || []).map(l => ({
      id: l.id,
      channel: 'EMAIL',
      recipient: l.recipient_email,
      name: 'Applicant',
      control_number: l.request_id || 'N/A',
      message: l.subject,
      status: l.status,
      created_at: l.created_at
    }));

    const combined = [...formattedSms, ...formattedEmail].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    tableBody.innerHTML = '';
    if (combined.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-400">No notification records found in database.</td></tr>';
      return;
    }

    combined.forEach(log => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition-colors';

      let channelBadge = log.channel === 'EMAIL'
        ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800"><i class="fa-solid fa-envelope"></i> RESEND</span>'
        : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800"><i class="fa-solid fa-mobile-screen"></i> SMS</span>';

      let statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">MOCK_SENT</span>';
      if (log.status === 'DELIVERED' || log.status === 'SENT') {
        statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">DELIVERED (Live)</span>';
      } else if (log.status === 'SIMULATED_SENT') {
        statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">SIMULATED</span>';
      } else if (log.status === 'FAILED') {
        statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">FAILED</span>';
      }

      const dateObj = new Date(log.created_at);
      const dateFormatted = isNaN(dateObj) ? log.created_at : dateObj.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      tr.innerHTML = `
        <td class="px-5 py-3 font-mono text-slate-500">
          <div class="mb-1">${channelBadge}</div>
          <span class="text-[10px] text-slate-400">#${String(log.id).slice(0, 8)}</span>
        </td>
        <td class="px-5 py-3 font-mono font-bold text-slate-800">${log.recipient}</td>
        <td class="px-5 py-3">
          <div class="font-bold text-slate-900">${log.name}</div>
          <div class="font-mono text-[10px] text-phblue">${log.control_number}</div>
        </td>
        <td class="px-5 py-3 max-w-xs text-slate-600 truncate" title="${String(log.message).replace(/"/g, '&quot;')}">
          ${log.message}
        </td>
        <td class="px-5 py-3">${statusBadge}</td>
        <td class="px-5 py-3 text-slate-400 text-[11px]">${dateFormatted}</td>
      `;

      tableBody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error fetching notification logs:', err);
    tableBody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-red-500">Failed to load notification logs.</td></tr>';
  }
}

