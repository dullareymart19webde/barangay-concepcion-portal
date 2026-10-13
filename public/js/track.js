document.addEventListener('DOMContentLoaded', () => {
  const trackForm = document.getElementById('trackForm');
  const controlInput = document.getElementById('controlNumberInput');
  const trackSubmitBtn = document.getElementById('trackSubmitBtn');
  const trackBtnText = document.getElementById('trackBtnText');
  const trackBtnIcon = document.getElementById('trackBtnIcon');
  const trackBtnSpinner = document.getElementById('trackBtnSpinner');

  const notFoundBox = document.getElementById('notFoundBox');
  const notFoundMsg = document.getElementById('notFoundMsg');
  const resultContainer = document.getElementById('resultContainer');

  // Result display elements
  const resControlNumber = document.getElementById('resControlNumber');
  const resCreatedAt = document.getElementById('resCreatedAt');
  const resStatusBadge = document.getElementById('resStatusBadge');
  const resStatusDot = document.getElementById('resStatusDot');
  const resStatusText = document.getElementById('resStatusText');

  const visualTimeline = document.getElementById('visualTimeline');
  const timelineProgressFill = document.getElementById('timelineProgressFill');
  const step1Circle = document.getElementById('step1Circle');
  const step2Circle = document.getElementById('step2Circle');
  const step3Circle = document.getElementById('step3Circle');
  const step4Circle = document.getElementById('step4Circle');

  const rejectionNotice = document.getElementById('rejectionNotice');
  const rejectionReasonText = document.getElementById('rejectionReasonText');
  const pickupCallout = document.getElementById('pickupCallout');

  const resFullName = document.getElementById('resFullName');
  const resCertType = document.getElementById('resCertType');
  const resPurok = document.getElementById('resPurok');
  const resContact = document.getElementById('resContact');
  const resPurpose = document.getElementById('resPurpose');
  const resRemarks = document.getElementById('resRemarks');
  const auditTimelineList = document.getElementById('auditTimelineList');


  // Handle Form Submit
  trackForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = controlInput.value.trim();
    if (query) {
      performTrack(query);
    }
  });

  // Auto-search if ref param exists in URL
  const urlParams = new URLSearchParams(window.location.search);
  const refParam = urlParams.get('ref');
  if (refParam) {
    controlInput.value = refParam.trim();
    performTrack(refParam.trim());
  }

  async function performTrack(controlNumber) {
    setLoading(true);
    notFoundBox.classList.add('hidden');
    resultContainer.classList.add('hidden');

    try {
      const response = await fetch(`/api/track/${encodeURIComponent(controlNumber.trim())}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        notFoundMsg.textContent = data.message || `No record found for "${controlNumber}". Please check the spelling.`;
        notFoundBox.classList.remove('hidden');
        setLoading(false);
        return;
      }

      renderTrackResult(data.data);
      resultContainer.classList.remove('hidden');
      resultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      console.error('Tracking query error:', err);
      notFoundMsg.textContent = 'A network error occurred while connecting to the tracking service. Please try again.';
      notFoundBox.classList.remove('hidden');
    } finally {
      setLoading(false);
    }
  }

  function setLoading(isLoading) {
    trackSubmitBtn.disabled = isLoading;
    if (isLoading) {
      trackBtnText.textContent = 'Searching...';
      trackBtnIcon.classList.add('hidden');
      trackBtnSpinner.classList.remove('hidden');
    } else {
      trackBtnText.textContent = 'Search Status';
      trackBtnIcon.classList.remove('hidden');
      trackBtnSpinner.classList.add('hidden');
    }
  }

  function renderTrackResult(info) {
    resControlNumber.textContent = info.controlNumber;
    
    // Format timestamp
    const dateObj = new Date(info.createdAt);
    resCreatedAt.textContent = isNaN(dateObj) ? info.createdAt : dateObj.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    resFullName.textContent = info.fullName;
    resCertType.textContent = info.certType;
    resPurok.textContent = `${info.purok}, Barangay Concepcion, Valencia City`;
    resContact.textContent = info.contactNumber;
    resPurpose.textContent = info.purpose;
    resRemarks.textContent = info.adminRemarks || 'No additional remarks provided.';

    // Status Badge & Timeline logic
    const status = info.status;
    const stage = info.currentStage;

    // Reset styles
    resStatusBadge.className = 'inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-extrabold shadow-2xs';
    resStatusText.textContent = status;

    if (status === 'Rejected') {
      resStatusBadge.classList.add('bg-red-100', 'text-red-800', 'border', 'border-red-300');
      resStatusDot.className = 'w-2.5 h-2.5 rounded-full bg-red-600';
      visualTimeline.classList.add('hidden');
      rejectionNotice.classList.remove('hidden');
      rejectionReasonText.textContent = info.adminRemarks || 'Application does not meet the necessary requirements.';
      pickupCallout.classList.add('hidden');
    } else {
      visualTimeline.classList.remove('hidden');
      rejectionNotice.classList.add('hidden');

      if (status === 'Ready for Pickup') {
        resStatusBadge.classList.add('bg-emerald-100', 'text-emerald-800', 'border', 'border-emerald-300');
        resStatusDot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse';
        pickupCallout.classList.remove('hidden');
      } else if (status === 'Released') {
        resStatusBadge.classList.add('bg-blue-100', 'text-phblue', 'border', 'border-blue-300');
        resStatusDot.className = 'w-2.5 h-2.5 rounded-full bg-phblue';
        pickupCallout.classList.add('hidden');
      } else if (status === 'Processing') {
        resStatusBadge.classList.add('bg-amber-100', 'text-amber-800', 'border', 'border-amber-300');
        resStatusDot.className = 'w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse';
        pickupCallout.classList.add('hidden');
      } else {
        // Pending Review
        resStatusBadge.classList.add('bg-slate-100', 'text-slate-700', 'border', 'border-slate-300');
        resStatusDot.className = 'w-2.5 h-2.5 rounded-full bg-slate-500';
        pickupCallout.classList.add('hidden');
      }

      // Update Visual Steps & Connecting Bar
      updateTimelineSteps(stage);
    }

    // Render Audit Trail
    auditTimelineList.innerHTML = '';
    if (info.timeline && info.timeline.length > 0) {
      info.timeline.forEach((item, index) => {
        const itemDate = new Date(item.timestamp);
        const formattedDate = isNaN(itemDate) ? item.timestamp : itemDate.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });

        const stepDiv = document.createElement('div');
        stepDiv.className = 'flex items-start space-x-3 text-xs';
        stepDiv.innerHTML = `
          <div class="w-6 h-6 rounded-full bg-blue-100 text-phblue flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
            ${index + 1}
          </div>
          <div class="bg-slate-50 border border-slate-200 p-3 rounded-xl w-full">
            <div class="flex items-center justify-between font-bold text-slate-800 mb-0.5">
              <span>Status: <span class="text-phblue">${item.status}</span></span>
              <span class="text-[11px] text-slate-400 font-normal">${formattedDate}</span>
            </div>
            <div class="text-slate-600 mt-1">${item.remarks || 'Status logged.'}</div>
            <div class="text-[10px] text-slate-400 mt-1">Updated by: <span class="font-medium text-slate-600">${item.changedBy}</span></div>
          </div>
        `;
        auditTimelineList.appendChild(stepDiv);
      });
    } else {
      auditTimelineList.innerHTML = '<div class="text-xs text-slate-500 italic">No additional history recorded yet.</div>';
    }
  }

  function updateTimelineSteps(stage) {
    // 1: Pending (25%), 2: Processing (50%), 3: Ready (75%), 4: Released (100%)
    const pct = Math.max(15, Math.min(100, stage * 25));
    timelineProgressFill.style.width = `${pct}%`;

    const steps = [
      { el: step1Circle, target: 1 },
      { el: step2Circle, target: 2 },
      { el: step3Circle, target: 3 },
      { el: step4Circle, target: 4 }
    ];

    steps.forEach(({ el, target }) => {
      if (stage >= target) {
        el.className = 'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-phblue text-white ring-4 ring-white shadow-xs';
      } else {
        el.className = 'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-slate-200 text-slate-400 ring-4 ring-white shadow-xs';
      }
    });
  }
});

