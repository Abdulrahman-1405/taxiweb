/**
 * Driver Console Dashboard Logic
 * Manages stats updates, inquiries tables, filtering, action popups, settings,
 * and Web Audio API synthesized notifications on new inquiries.
 * Custom built for Chauffeur Fardeen Patel's Camry Taxi.
 */

// Auth guard - runs immediately, before DOM is ready, to bounce unauthenticated


document.addEventListener('DOMContentLoaded', () => {
  if (!window.TaxiDB) {
    console.error('Database module (db.js) not found!');
    return;
  }
  
  // Dashboard State
  let currentFilter = 'all';
  let lastKnownInquiryCount = 0;
  let firstSync = true;

  // DOM Elements - Metrics
  const metricBookings = document.getElementById('metric-total-bookings');
  const metricPending = document.getElementById('metric-pending');
  const metricCompleted = document.getElementById('metric-completed');

  // DOM Elements - Inquiries Table
  const bookingTableBody = document.getElementById('bookings-table-body');
  const filterBtns = document.querySelectorAll('.filter-btn');

  // DOM Elements - Settings
  const formSettings = document.getElementById('owner-settings-form');
  const inputDriverName = document.getElementById('set-driver-name');
  const inputVehicleInfo = document.getElementById('set-vehicle-info');
  const inputPhone = document.getElementById('set-phone');
  const inputSmsLink = document.getElementById('set-sms-link');
  const inputEmail = document.getElementById('set-email');
  const inputVolume = document.getElementById('sound-volume');

  // DOM Elements - Detail Modal
  const modalOverlay = document.getElementById('detail-modal');
  const btnCloseModal = document.getElementById('modal-close-btn');

  // DOM Elements - Logout
  const btnLogout = document.getElementById('btn-logout');

  // Audio Notification Synthesizer using Web Audio API
  const playNotificationSound = (volume = 0.5) => {
    if (volume <= 0) return;

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;

      // Play a premium alert chirp tone
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.1); // A5
      osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.25); // D6

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume * 0.4, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.4);

      // Flash notification bell visually
      const bell = document.querySelector('.bell-notification');
      if (bell) {
        bell.classList.add('ringing');
        setTimeout(() => {
          bell.classList.remove('ringing');
        }, 1200);
      }
    } catch (e) {
      console.warn("AudioContext failed to initialize: ", e);
    }
  };

  // Calculate and Render Metrics Card Values
  const updateMetrics = (inquiries) => {
    // 1. Total inquiries
    if (metricBookings) metricBookings.textContent = inquiries.length;

    // 2. Pending Callbacks count
    const pendingInquiries = inquiries.filter(i => i.status === 'pending');
    if (metricPending) {
      metricPending.textContent = pendingInquiries.length;
      if (pendingInquiries.length > 0) {
        metricPending.closest('.metric-card').style.border = '1px solid rgba(245, 158, 11, 0.4)';
      } else {
        metricPending.closest('.metric-card').style.border = '1px solid var(--border-color)';
      }
    }

    // 3. Connected & Archived count
    const completedCount = inquiries.filter(i => i.status === 'connected' || i.status === 'archived').length;
    if (metricCompleted) metricCompleted.textContent = completedCount;

    // Update notifications badge in header
    const bellBadge = document.getElementById('bell-badge');
    if (bellBadge) {
      if (pendingInquiries.length > 0) {
        bellBadge.textContent = pendingInquiries.length;
        bellBadge.style.display = 'flex';
      } else {
        bellBadge.style.display = 'none';
      }
    }
  };

  // Populate Inquiries List Table
  const renderInquiriesTable = (inquiries) => {
    if (!bookingTableBody) return;

    let filteredInquiries = inquiries;

    if (currentFilter !== 'all') {
      filteredInquiries = inquiries.filter(i => i.status === currentFilter);
    }

    bookingTableBody.innerHTML = '';

    if (filteredInquiries.length === 0) {
      bookingTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">
            No inquiries found under this category.
          </td>
        </tr>
      `;
      return;
    }

    filteredInquiries.forEach(inq => {
      const date = new Date(inq.datetime);
      const isContactOnly = inq.passengers === 0;

      const formattedDate = isContactOnly ? 'Message Inquiry' :
                            date.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' }) + ' ' +
                            date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 700; color: var(--primary);">${inq.id}</td>
        <td>
          <div style="font-weight: 600;">${inq.customerName}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${inq.phone}</div>
        </td>
        <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${inq.pickup}">
          ${inq.pickup}
        </td>
        <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${inq.destination}">
          ${inq.destination}
        </td>
        <td>${formattedDate}</td>
        <td>
          <span class="badge badge-${inq.status}">${inq.status}</span>
        </td>
        <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-style:italic;" title="${inq.notes || 'No requests'}">
          ${inq.notes || '--'}
        </td>
        <td>
          <div class="action-group">
            <button class="btn-action btn-view" title="Inspect Details" data-id="${inq.id}">
              <i class="fas fa-eye"></i>
            </button>
            ${inq.status === 'pending' ? `
              <button class="btn-action btn-accept" title="Mark Connected / Called" data-id="${inq.id}">
                <i class="fas fa-phone-alt"></i>
              </button>
              <button class="btn-action btn-decline" title="Archive Request" data-id="${inq.id}">
                <i class="fas fa-archive"></i>
              </button>
            ` : ''}
            ${inq.status === 'connected' ? `
              <button class="btn-action btn-decline" title="Archive Request" data-id="${inq.id}">
                <i class="fas fa-archive"></i>
              </button>
            ` : ''}
          </div>
        </td>
      `;
      bookingTableBody.appendChild(tr);
    });

    // Attach button events
    bookingTableBody.querySelectorAll('.btn-view').forEach(btn => {
      btn.addEventListener('click', () => showInquiryDetails(btn.getAttribute('data-id'), inquiries));
    });

    bookingTableBody.querySelectorAll('.btn-accept').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await window.TaxiDB.updateInquiryStatus(id, 'connected');
        syncDashboard();
      });
    });

    bookingTableBody.querySelectorAll('.btn-decline').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await window.TaxiDB.updateInquiryStatus(id, 'archived');
        syncDashboard();
      });
    });
  };

  // Filter tab actions
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('btn-primary'));
      filterBtns.forEach(b => b.classList.add('btn-secondary'));

      btn.classList.remove('btn-secondary');
      btn.classList.add('btn-primary');

      currentFilter = btn.getAttribute('data-filter');
      syncDashboard();
    });
  });

  // Detailed inquiry display in modal
  const showInquiryDetails = (id, inquiries) => {
    const inq = inquiries.find(i => i.id === id);
    if (!inq) return;

    const isContactOnly = inq.passengers === 0;
    const date = new Date(inq.datetime);
    const dateFormatted = isContactOnly ? 'General Mail inquiry' :
                          date.toLocaleDateString('en-AU', {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                          }) + ' at ' + date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });

    const modalBody = document.getElementById('modal-details-body');

    let footerActionsHtml = '';
    if (inq.status === 'pending') {
      footerActionsHtml = `
        <div style="display:flex; gap: 15px; margin-top: 25px;">
          <button id="modal-btn-connect" class="btn btn-primary" style="flex:1;"><i class="fas fa-check"></i> Mark Connected</button>
          <button id="modal-btn-archive" class="btn btn-secondary" style="flex:1;"><i class="fas fa-archive"></i> Archive</button>
        </div>
      `;
    } else if (inq.status === 'connected') {
      footerActionsHtml = `
        <div style="display:flex; gap: 15px; margin-top: 25px;">
          <button id="modal-btn-archive" class="btn btn-secondary" style="width:100%;"><i class="fas fa-archive"></i> Archive Inquiry</button>
        </div>
      `;
    }

    modalBody.innerHTML = `
      <div class="detail-row">
        <div class="detail-label">Status</div>
        <div class="detail-value"><span class="badge badge-${inq.status}">${inq.status}</span></div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Customer Name</div>
        <div class="detail-value" style="font-weight:700;">${inq.customerName}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Phone</div>
        <div class="detail-value">
          <a href="tel:${inq.phone}">${inq.phone}</a>
          <a href="sms:${inq.phone.replace(/[^0-9+]/g, '')}" style="margin-left: 15px; color:var(--accent);" title="SMS customer">
            <i class="fas fa-comment-alt"></i> Send SMS
          </a>
        </div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Email</div>
        <div class="detail-value"><a href="mailto:${inq.email}">${inq.email}</a></div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Pickup Address</div>
        <div class="detail-value">${inq.pickup}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Destination</div>
        <div class="detail-value">${inq.destination}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Requested Time</div>
        <div class="detail-value">${dateFormatted}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Passengers</div>
        <div class="detail-value">${isContactOnly ? 'N/A' : inq.passengers}</div>
      </div>
      <div class="detail-row" style="flex-direction:column; border:none; padding-bottom: 0;">
        <div class="detail-label" style="width:100%; margin-bottom: 5px;">Special Requirements / Message</div>
        <div class="detail-value" style="background:rgba(0,0,0,0.02); padding:10px; border-radius:6px; font-style:italic; border:1px solid #E2E8F0;">
          ${inq.notes || 'None provided.'}
        </div>
      </div>
      ${footerActionsHtml}
    `;

    modalOverlay.classList.add('active');

    // Attach actions in modal
    const btnMConnect = document.getElementById('modal-btn-connect');
    const btnMArchive = document.getElementById('modal-btn-archive');

    if (btnMConnect) {
      btnMConnect.addEventListener('click', async () => {
        await window.TaxiDB.updateInquiryStatus(id, 'connected');
        modalOverlay.classList.remove('active');
        syncDashboard();
      });
    }
    if (btnMArchive) {
      btnMArchive.addEventListener('click', async () => {
        await window.TaxiDB.updateInquiryStatus(id, 'archived');
        modalOverlay.classList.remove('active');
        syncDashboard();
      });
    }
  };

  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
      modalOverlay.classList.remove('active');
    });
  }

  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        modalOverlay.classList.remove('active');
      }
    });
  }

  // Populate driver profile settings
  const initSettingsForm = async () => {
    if (!inputPhone) return;
    const settings = await window.TaxiDB.getSettings();

    inputDriverName.value = settings.ownerName;
    inputVehicleInfo.value = settings.vehicle;
    inputPhone.value = settings.ownerPhone;
    inputSmsLink.value = settings.ownerSms;
    inputEmail.value = settings.ownerEmail;
  };

  // Handle settings form submit
  if (formSettings) {
    formSettings.addEventListener('submit', async (e) => {
      e.preventDefault();

      const newSettings = {
        ownerName: inputDriverName.value.trim(),
        vehicle: inputVehicleInfo.value.trim(),
        ownerPhone: inputPhone.value.trim(),
        ownerSms: inputSmsLink.value.trim(),
        ownerEmail: inputEmail.value.trim()
      };

      try {
        await window.TaxiDB.saveSettings(newSettings);
        alert('Profile details updated successfully! Website links have synced.');
      } catch (err) {
        alert(err.message || 'Could not save settings. Please try again.');
      }
    });
  }

  // Sound test triggers
  const btnTestSound = document.getElementById('btn-test-sound');
  if (btnTestSound) {
    btnTestSound.addEventListener('click', () => {
      const vol = parseFloat(inputVolume.value);
      playNotificationSound(vol);
    });
  }

  // Logout
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      window.TaxiDB.logout();
      window.location.href = 'owner-login.html';
    });
  }

  // Synchronize Dashboard Views - polls the backend so this tab reflects
  // new inquiries submitted from any device, not just this browser.
  const syncDashboard = async () => {
    let inquiries;
    try {
      inquiries = await window.TaxiDB.getInquiries();
    } catch (err) {
      console.warn('Could not refresh inquiries:', err.message);
      return;
    }

    // Play chime when new inquiry is submitted on client portal
    if (!firstSync && inquiries.length > lastKnownInquiryCount) {
      const newPending = inquiries.filter(i => i.status === 'pending');
      if (newPending.length > 0) {
        const vol = inputVolume ? parseFloat(inputVolume.value) : 0.5;
        playNotificationSound(vol);
      }
    }

    lastKnownInquiryCount = inquiries.length;
    firstSync = false;

    updateMetrics(inquiries);
    renderInquiriesTable(inquiries);
  };

  // Initial Sync calls
  syncDashboard();
  initSettingsForm();

  // Poll for updates every 8 seconds so the dashboard stays live
  setInterval(syncDashboard, 8000);

  // Enable click trigger on bell to test sound
  const bell = document.querySelector('.bell-notification');
  if (bell) {
    bell.addEventListener('click', () => {
      playNotificationSound(0.4);
    });
  }

  // Switch tabs
  const sidebarItems = document.querySelectorAll('.sidebar-item');
  const tabPanels = document.querySelectorAll('.tab-panel');

  sidebarItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = item.getAttribute('data-tab');
      if (!tabId) return;

      sidebarItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      tabPanels.forEach(panel => {
        if (panel.id === `${tabId}-panel`) {
          panel.classList.add('active');
        } else {
          panel.classList.remove('active');
        }
      });
    });
  });
});
