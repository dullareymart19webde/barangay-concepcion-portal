document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('certificateForm');
  const certTypeSelect = document.getElementById('certType');
  const certNoticeText = document.getElementById('certNoticeText');
  const dropZone = document.getElementById('dropZone');
  const validIdInput = document.getElementById('validId');
  const dropPrompt = document.getElementById('dropPrompt');
  const filePreview = document.getElementById('filePreview');
  const fileName = document.getElementById('fileName');
  const fileSize = document.getElementById('fileSize');
  const removeFileBtn = document.getElementById('removeFileBtn');
  const contactInput = document.getElementById('contactNumber');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const btnIcon = document.getElementById('btnIcon');
  const btnSpinner = document.getElementById('btnSpinner');
  const errorAlert = document.getElementById('errorAlert');
  const errorList = document.getElementById('errorList');

  // Success Modal Elements
  const successModal = document.getElementById('successModal');
  const modalControlNumber = document.getElementById('modalControlNumber');
  const modalQrCode = document.getElementById('modalQrCode');
  const copyBtn = document.getElementById('copyBtn');
  const copyBtnText = document.getElementById('copyBtnText');
  const trackLinkBtn = document.getElementById('trackLinkBtn');
  const printReceiptBtn = document.getElementById('printReceiptBtn');

  // 1. Auto-select certificate type if provided in URL query string
  const urlParams = new URLSearchParams(window.location.search);
  const typeParam = urlParams.get('type');
  if (typeParam) {
    for (let opt of certTypeSelect.options) {
      if (opt.value.toLowerCase() === typeParam.toLowerCase()) {
        certTypeSelect.value = opt.value;
        break;
      }
    }
  }

  // 2. Dynamic Certificate Notices
  function updateCertNotice() {
    const selected = certTypeSelect.value;
    if (selected === 'Barangay Clearance') {
      certNoticeText.innerHTML = '<strong>Barangay Clearance:</strong> Requires 6+ months residency. Standard fee applies at Barangay Hall upon release. Please bring your Cedula and 1 valid photo ID.';
    } else if (selected === 'Certificate of Residency') {
      certNoticeText.innerHTML = '<strong>Certificate of Residency:</strong> Verifies residence in your specified Purok. Used for scholarships, student enrollment, and opening bank accounts.';
    } else if (selected === 'Certificate of Indigency') {
      certNoticeText.innerHTML = '<strong>Certificate of Indigency:</strong> 100% FREE OF CHARGE. Issued for medical assistance, hospital discounts, DSWD social relief, and PAO legal aid.';
    } else {
      certNoticeText.textContent = 'Please select a certificate type to view specific requirements and guidelines.';
    }
  }
  certTypeSelect.addEventListener('change', updateCertNotice);
  updateCertNotice();

  // 3. File Upload / Drag & Drop
  dropZone.addEventListener('click', (e) => {
    if (e.target !== removeFileBtn && !removeFileBtn.contains(e.target)) {
      validIdInput.click();
    }
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-phblue', 'bg-blue-50/50');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-phblue', 'bg-blue-50/50');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-phblue', 'bg-blue-50/50');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  validIdInput.addEventListener('change', () => {
    if (validIdInput.files && validIdInput.files.length > 0) {
      handleFileSelected(validIdInput.files[0]);
    }
  });

  function handleFileSelected(file) {
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds the 5MB maximum limit. Please choose a smaller image or PDF.');
      validIdInput.value = '';
      return;
    }

    fileName.textContent = file.name;
    fileSize.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB • ${file.type || 'Document'}`;
    dropPrompt.classList.add('hidden');
    filePreview.classList.remove('hidden');
  }

  removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    validIdInput.value = '';
    dropPrompt.classList.remove('hidden');
    filePreview.classList.add('hidden');
  });

  // 4. Contact Number live cleanup
  contactInput.addEventListener('input', () => {
    contactInput.value = contactInput.value.replace(/[^0-9+]/g, '');
  });

  // 5. Data Privacy Consent Interactive Checkbox Controller
  const privacyConsent = document.getElementById('privacyConsent');
  const visualCheckbox = document.getElementById('visualCheckbox');
  const visualCheckIcon = document.getElementById('visualCheckIcon');
  const consentCard = document.getElementById('consentCard');

  function updateConsentDisplay() {
    if (!privacyConsent || !visualCheckbox) return;

    if (privacyConsent.checked) {
      visualCheckbox.className = 'w-6 h-6 rounded-md border-2 border-phblue bg-phblue flex items-center justify-center shrink-0 mt-0.5 shadow-xs transition-all';
      if (visualCheckIcon) visualCheckIcon.classList.remove('hidden');
      if (consentCard) {
        consentCard.classList.remove('border-blue-200', 'border-red-400', 'bg-red-50/50');
        consentCard.classList.add('border-phblue', 'ring-2', 'ring-blue-100');
      }
    } else {
      visualCheckbox.className = 'w-6 h-6 rounded-md border-2 border-slate-400 bg-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs transition-all hover:border-phblue';
      if (visualCheckIcon) visualCheckIcon.classList.add('hidden');
      if (consentCard) {
        consentCard.classList.remove('border-phblue', 'ring-2', 'ring-blue-100');
        consentCard.classList.add('border-blue-200');
      }
    }
  }

  if (privacyConsent && visualCheckbox) {
    privacyConsent.addEventListener('change', updateConsentDisplay);
    updateConsentDisplay();
  }

  // 6. Form Submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideErrors();

    // Client-side quick checks
    const errors = [];
    if (!certTypeSelect.value) errors.push('Please select a certificate type.');
    if (!form.firstName.value.trim()) errors.push('First name is required.');
    if (!form.lastName.value.trim()) errors.push('Last name is required.');
    if (!form.purok.value) errors.push('Purok / Street address is required.');
    if (!form.birthDate.value) errors.push('Date of birth is required.');
    if (!form.civilStatus.value) errors.push('Civil status is required.');
    if (!form.gender.value) errors.push('Gender is required.');
    if (!form.purpose.value.trim()) errors.push('Purpose of certificate is required.');

    let rawPhone = contactInput.value.trim();
    if (!rawPhone) {
      errors.push('Mobile contact number is required.');
    } else {
      let cleanPhone = rawPhone.replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('63') && cleanPhone.length === 12) {
        cleanPhone = '0' + cleanPhone.slice(2);
      }
      if (!/^09\d{9}$/.test(cleanPhone)) {
        errors.push('Please enter a valid 11-digit Philippine mobile number (e.g. 09171234567).');
      }
    }

    const rawEmail = form.email ? form.email.value.trim() : '';
    if (!rawEmail) {
      errors.push('Email address is required for official digital receipts and pickup notifications.');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      errors.push('Please enter a valid email address (e.g. resident@gmail.com).');
    }

    if (!form.privacyConsent.checked) {
      errors.push('You must accept the Data Privacy Act agreement to proceed.');
      if (consentCard) {
        consentCard.classList.remove('border-blue-200');
        consentCard.classList.add('border-red-400', 'bg-red-50/60');
      }
    }

    if (errors.length > 0) {
      showErrors(errors);
      window.scrollTo({ top: errorAlert.offsetTop - 100, behavior: 'smooth' });
      return;
    }

    // Submit state
    setLoading(true);

    try {
      const formData = new FormData(form);

      const response = await fetch('/api/requests', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        if (result.code === 'DUPLICATE_ACTIVE_REQUEST' && result.existingControlNumber) {
          showDuplicateWarning(result);
        } else {
          const errorMessages = result.errors || [result.message || 'Submission failed. Please verify your details.'];
          showErrors(errorMessages);
        }
        window.scrollTo({ top: errorAlert.offsetTop - 100, behavior: 'smooth' });
        setLoading(false);
        return;
      }

      // Submission Success! Display Success Modal
      displaySuccess(result);
    } catch (err) {
      console.error('Submission error:', err);
      showErrors(['Network or server communication error. Please try again.']);
      window.scrollTo({ top: errorAlert.offsetTop - 100, behavior: 'smooth' });
      setLoading(false);
    }
  });

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    if (isLoading) {
      btnText.textContent = 'Submitting Application...';
      btnIcon.classList.add('hidden');
      btnSpinner.classList.remove('hidden');
      submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
    } else {
      btnText.textContent = 'Submit Application';
      btnIcon.classList.remove('hidden');
      btnSpinner.classList.add('hidden');
      submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
  }

  function showErrors(messages) {
    const errorAlertTitle = document.getElementById('errorAlertTitle');
    if (errorAlertTitle) {
      errorAlertTitle.textContent = 'Please correct the following errors:';
    }
    errorList.innerHTML = '';
    messages.forEach(msg => {
      const li = document.createElement('li');
      li.textContent = msg;
      errorList.appendChild(li);
    });
    errorAlert.classList.remove('hidden');
  }

  function showDuplicateWarning(data) {
    const errorAlertTitle = document.getElementById('errorAlertTitle');
    if (errorAlertTitle) {
      errorAlertTitle.textContent = 'Active Application Already In Progress:';
    }
    errorList.innerHTML = `
      <li class="list-none mb-1">
        <p class="font-semibold text-slate-800">${data.message || data.errors[0]}</p>
        <div class="mt-3 p-3.5 bg-white rounded-xl border border-red-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <div class="text-[10px] uppercase font-bold text-slate-500">Active Control Tracking Number</div>
            <div class="font-mono font-black text-sm text-phblue mt-0.5">${data.existingControlNumber}</div>
            <div class="text-[11px] text-slate-600 mt-0.5">Current Status: <strong class="text-amber-700 font-bold">${data.existingStatus || 'In Progress'}</strong></div>
          </div>
          <a href="/track.html?ref=${encodeURIComponent(data.existingControlNumber)}" class="inline-flex items-center justify-center px-4 py-2 bg-phblue hover:bg-blue-800 text-white font-bold rounded-lg shadow-xs transition-colors whitespace-nowrap">
            <i class="fa-solid fa-magnifying-glass mr-1.5"></i> Track Application
          </a>
        </div>
        <p class="text-[11px] text-slate-600 mt-2 font-medium">
          <i class="fa-solid fa-circle-info text-phblue mr-1"></i> Note: If you require a different certificate (e.g. Certificate of Residency or Indigency), you may select that document above and proceed with filing.
        </p>
      </li>
    `;
    errorAlert.classList.remove('hidden');
  }

  function hideErrors() {
    errorAlert.classList.add('hidden');
    errorList.innerHTML = '';
    const errorAlertTitle = document.getElementById('errorAlertTitle');
    if (errorAlertTitle) {
      errorAlertTitle.textContent = 'Please correct the following errors:';
    }
  }

  function displaySuccess(data) {
    modalControlNumber.textContent = data.controlNumber;
    if (data.qrCode) {
      modalQrCode.src = data.qrCode;
    } else {
      modalQrCode.parentElement.classList.add('hidden');
    }

    trackLinkBtn.href = `/track?ref=${encodeURIComponent(data.controlNumber)}`;
    successModal.classList.remove('hidden');

    // 1-Click Copy Control Number
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(data.controlNumber).then(() => {
        copyBtnText.textContent = 'Copied to Clipboard!';
        copyBtn.classList.add('bg-emerald-50', 'text-emerald-700', 'border-emerald-300');
        setTimeout(() => {
          copyBtnText.textContent = 'Copy Control Number';
          copyBtn.classList.remove('bg-emerald-50', 'text-emerald-700', 'border-emerald-300');
        }, 3000);
      });
    };

    // Print Receipt Slip
    printReceiptBtn.onclick = () => {
      const applicantName = `${form.firstName.value} ${form.lastName.value}`;
      const certType = form.certType.value;
      const purok = form.purok.value;
      const date = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });

      const printWindow = window.open('', '_blank', 'width=600,height=700');
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Barangay Concepcion - Acknowledgement Receipt</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 25px; color: #1e293b; }
            .header { text-align: center; border-bottom: 2px solid #0038A8; padding-bottom: 12px; margin-bottom: 15px; }
            .title { font-size: 16px; font-weight: bold; color: #0038A8; }
            .sub { font-size: 12px; color: #64748b; }
            .box { background: #f8fafc; border: 2px dashed #0038A8; padding: 15px; text-align: center; margin: 15px 0; border-radius: 8px; }
            .num { font-size: 22px; font-weight: bold; color: #0038A8; letter-spacing: 2px; }
            .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
            .label { font-weight: bold; color: #475569; }
            .notice { font-size: 11px; color: #64748b; margin-top: 15px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="sub">Republic of the Philippines • Valencia City, Bukidnon</div>
            <div class="title">BARANGAY CONCEPCION</div>
            <div class="sub">Online Certificate Application Acknowledgement</div>
          </div>
          <div class="box">
            <div style="font-size: 11px; text-transform: uppercase; color: #64748b;">Unique Control Number</div>
            <div class="num">${data.controlNumber}</div>
          </div>
          <div class="row"><span class="label">Applicant Name:</span> <span>${applicantName}</span></div>
          <div class="row"><span class="label">Certificate Type:</span> <span>${certType}</span></div>
          <div class="row"><span class="label">Purok Address:</span> <span>${purok}</span></div>
          <div class="row"><span class="label">Date Submitted:</span> <span>${date}</span></div>
          <div class="row"><span class="label">Current Status:</span> <span>Pending Review</span></div>
          <div class="notice">
            <strong>Important Notice:</strong><br/>
            Please present this acknowledgement slip along with 1 valid ID at Barangay Concepcion Hall once you receive the "Ready for Pickup" SMS notice.
            Office Hours: Monday - Friday, 8:00 AM - 5:00 PM.
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    };
  }
});

