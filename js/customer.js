/**
 * Customer Booking Portal Logic
 * Handles inquiry submission and settings synchronization.
 * Custom built for Silver Cab Service (fleet: 4 / 7 / 11 seater vehicles).
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements - Inquiry Form
  const inquiryForm = document.getElementById('inquiry-submit-form');
  const successScreen = document.getElementById('booking-success-screen');

  // DOM Elements - Inputs
  const inputPickup = document.getElementById('pickup-address');
  const inputDrop = document.getElementById('drop-address');
  const inputDatetime = document.getElementById('pickup-time');
  const selectPassengers = document.getElementById('passenger-count');
  const selectVehicleType = document.getElementById('vehicle-type');
  const selectBabySeat = document.getElementById('baby-seat');
  const selectWheelchair = document.getElementById('wheelchair-access');
  const inputName = document.getElementById('customer-name');
  const selectPhoneCode = document.getElementById('phone-country-code');
  const inputPhone = document.getElementById('customer-phone');
  const inputEmail = document.getElementById('customer-email');
  const inputNotes = document.getElementById('special-instructions');
  const selectPaymentMethod = document.getElementById('payment-method');

  // Dynamically Sync Driver Contact Information from Settings
  const syncDriverContactInfo = async () => {
    if (!window.TaxiDB) return;
    let settings;
    try {
      settings = await window.TaxiDB.getSettings();
    } catch (err) {
      console.warn('Could not load driver settings:', err.message);
      return;
    }
    if (!settings) return;

    // Header Call Button
    const headerPhoneBtn = document.getElementById('header-phone-btn');
    if (headerPhoneBtn) {
      headerPhoneBtn.href = `tel:${settings.ownerPhone.replace(/\s+/g, '')}`;
      headerPhoneBtn.innerHTML = `<i class="fas fa-phone-alt" style="color: var(--primary);"></i> Call Chauffeur`;
    }

    // Floating Contact Buttons
    const floatPhoneLink = document.getElementById('float-phone-link');
    if (floatPhoneLink) {
      floatPhoneLink.href = `tel:${settings.ownerPhone.replace(/\s+/g, '')}`;
    }
    const floatSmsLink = document.getElementById('float-sms-link');
    if (floatSmsLink) {
      floatSmsLink.href = settings.ownerSms;
    }
    const floatEmailLink = document.getElementById('float-email-link');
    if (floatEmailLink) {
      floatEmailLink.href = `mailto:${settings.ownerEmail}`;
    }

    // Contacts Section phone, SMS text message, and emails
    document.querySelectorAll('.contact-phone-val').forEach(el => {
      el.textContent = settings.ownerPhone;
      el.href = `tel:${settings.ownerPhone.replace(/\s+/g, '')}`;
    });

    document.querySelectorAll('.contact-sms-val').forEach(el => {
      el.textContent = settings.ownerPhone;
      el.href = settings.ownerSms;
    });

    document.querySelectorAll('.contact-email-val').forEach(el => {
      el.textContent = settings.ownerEmail;
      el.href = `mailto:${settings.ownerEmail}`;
    });
  };

  // Sync info on initial load
  syncDriverContactInfo();

  // Initialize Default Date/Time to 2 hours from now
  const initDateTime = () => {
    const now = new Date();
    now.setHours(now.getHours() + 2);
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now - offset)).toISOString().slice(0, 16);
    if (inputDatetime) {
      inputDatetime.value = localISOTime;
    }
  };

  initDateTime();

  // Keep the "No. of Passengers" options in sync with the selected vehicle
  const passengerCapacity = {
    '4-seater': 4,
    '4-wagon': 4,
    '7-seater': 7,
    '11-seater': 11
  };

  const updatePassengerOptions = (vehicleValue) => {
    if (!selectPassengers) return;
    const max = passengerCapacity[vehicleValue] || 4;
    const previousVal = parseInt(selectPassengers.value, 10) || 1;

    selectPassengers.innerHTML = '';
    for (let i = 1; i <= max; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `${i} Passenger${i > 1 ? 's' : ''}${i === max ? ' (Max)' : ''}`;
      selectPassengers.appendChild(opt);
    }
    // Keep the previous selection if it still fits the new vehicle, otherwise clamp to the new max
    selectPassengers.value = Math.min(previousVal, max);
  };

  if (selectVehicleType) {
    updatePassengerOptions(selectVehicleType.value);
    selectVehicleType.addEventListener('change', () => updatePassengerOptions(selectVehicleType.value));
  }

  // Google-powered Address Autocomplete (Pickup / Destination)
  // Requires window.GOOGLE_MAPS_API_KEY to be set in js/config.js
  const initAddressAutocomplete = () => {
    if (!window.google || !window.google.maps || !window.google.maps.places) return;

    // Bias results to the greater Sydney metro area (still allows other AU results, just ranked lower)
    const sydneyBounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(-34.1183, 150.5209), // SW - roughly Camden/Campbelltown
      new google.maps.LatLng(-33.4245, 151.3430)  // NE - roughly Palm Beach
    );

    const autocompleteOptions = {
      componentRestrictions: { country: 'au' },
      bounds: sydneyBounds,
      strictBounds: false,
      fields: ['formatted_address', 'geometry', 'name']
    };

    if (inputPickup) new google.maps.places.Autocomplete(inputPickup, autocompleteOptions);
    if (inputDrop) new google.maps.places.Autocomplete(inputDrop, autocompleteOptions);
  };

  const loadGooglePlacesScript = () => {
    if (window.google && window.google.maps && window.google.maps.places) {
      initAddressAutocomplete();
      return;
    }
    if (!window.GOOGLE_MAPS_API_KEY) {
      // No key configured yet - address fields will work as plain text inputs.
      console.warn('Address autocomplete disabled: set window.GOOGLE_MAPS_API_KEY in js/config.js to enable it.');
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${window.GOOGLE_MAPS_API_KEY}&libraries=places&region=AU&language=en-AU`;
    script.async = true;
    script.defer = true;
    script.onerror = () => console.error('Failed to load Google Maps script. Check that GOOGLE_MAPS_API_KEY is valid and Places API is enabled for it.');
    script.onload = initAddressAutocomplete;
    document.head.appendChild(script);
  };

  loadGooglePlacesScript();

  // Handle Form Submission
  if (inquiryForm) {
    inquiryForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const pickupVal = inputPickup.value.trim();
      const dropVal = inputDrop.value.trim();
      const datetimeVal = inputDatetime.value;
      const passengerVal = parseInt(selectPassengers.value);
      const vehicleVal = selectVehicleType ? selectVehicleType.value : '';
      const babySeatVal = selectBabySeat ? selectBabySeat.value : 'no';
      const wheelchairVal = selectWheelchair ? selectWheelchair.value : 'no';
      const nameVal = inputName.value.trim();
      const phoneCodeVal = selectPhoneCode ? selectPhoneCode.value : '+61';
      const phoneVal = inputPhone.value.trim();
      const emailVal = inputEmail.value.trim();
      const notesVal = inputNotes.value.trim();
      const paymentVal = selectPaymentMethod ? selectPaymentMethod.value : '';

      // Basic validations
      if (!pickupVal) { alert('Please enter a pickup address.'); inputPickup.focus(); return; }
      if (!dropVal) { alert('Please enter a destination.'); inputDrop.focus(); return; }
      if (pickupVal.toLowerCase() === dropVal.toLowerCase()) { alert('Pickup and destination cannot be the same.'); inputDrop.focus(); return; }
      if (!datetimeVal) { alert('Please select date and time.'); inputDatetime.focus(); return; }

      const selectedDate = new Date(datetimeVal);
      if (selectedDate <= new Date()) {
        alert('Pickup time must be in the future.');
        inputDatetime.focus();
        return;
      }

      if (!nameVal) { alert('Please enter your name.'); inputName.focus(); return; }
      if (!phoneVal) { alert('Please enter your contact number.'); inputPhone.focus(); return; }

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailVal || !emailPattern.test(emailVal)) { alert('Please enter a valid email address.'); inputEmail.focus(); return; }

      if (!paymentVal) { alert('Please select a payment method.'); selectPaymentMethod.focus(); return; }

      const vehicleLabels = {
        '4-seater': '4 Seater (Sedan)',
        '4-wagon': '4 Seater (Wagon)',
        '7-seater': '7 Seater (Maxi)',
        '11-seater': '11 Seater (Maxi)'
      };
      const paymentLabels = {
        card: 'Credit / Debit Card',
        cabcharge: 'Cabcharge',
        cash: 'Cash'
      };

      const inquiryData = {
        pickup: pickupVal,
        destination: dropVal,
        datetime: datetimeVal,
        passengers: passengerVal,
        vehicleType: vehicleVal,
        babySeat: babySeatVal,
        wheelchairAccess: wheelchairVal,
        customerName: nameVal,
        phone: `${phoneCodeVal} ${phoneVal}`,
        email: emailVal,
        notes: notesVal,
        paymentMethod: paymentVal
      };

      if (!window.TaxiDB) {
        alert('Database component is loading. Please try again.');
        return;
      }

      const submitBtn = inquiryForm.querySelector('button[type="submit"]');
      const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
      }

      try {
        const result = await window.TaxiDB.addInquiry(inquiryData);
        const settings = await window.TaxiDB.getSettings();

        // Dynamically inject owner phone number into the required success message
        const phonePlaceholder = document.getElementById('succ-phone');
        if (phonePlaceholder && settings) {
          phonePlaceholder.textContent = settings.ownerPhone;
        }

        // Show details in success card
        document.getElementById('succ-id').textContent = result.id;
        document.getElementById('succ-vehicle').textContent = vehicleLabels[vehicleVal] || vehicleVal || '--';
        document.getElementById('succ-pickup').textContent = result.pickup;
        document.getElementById('succ-drop').textContent = result.destination;
        document.getElementById('succ-payment').textContent = paymentLabels[paymentVal] || paymentVal || '--';

        const dateObj = new Date(result.datetime);
        document.getElementById('succ-time').textContent = dateObj.toLocaleDateString('en-AU', {
          weekday: 'long', year: 'numeric', month: 'short', day: 'numeric'
        }) + ' at ' + dateObj.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });

        // Toggle UI panels
        inquiryForm.style.display = 'none';
        successScreen.style.display = 'block';
        successScreen.scrollIntoView({ behavior: 'smooth' });
      } catch (err) {
        alert(err.message || 'Something went wrong sending your inquiry. Please try again.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnHtml;
        }
      }
    });
  }

  // Quick message inquiry form submission
  const contactForm = document.getElementById('contact-inquiry-form');
  const contactAlert = document.getElementById('contact-alert');

  if (contactForm && contactAlert) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('contact-name').value.trim();
      const email = document.getElementById('contact-email').value.trim();
      const phone = document.getElementById('contact-phone').value.trim();
      const subject = document.getElementById('contact-subject').value.trim();
      const message = document.getElementById('contact-message').value.trim();

      if (!name || !email || !message) {
        contactAlert.className = 'alert alert-danger';
        contactAlert.textContent = 'Please fill out all required fields.';
        contactAlert.style.display = 'block';
        return;
      }

      const msgData = {
        pickup: 'Contact Inquiry Only',
        destination: 'General message',
        datetime: new Date().toISOString(),
        passengers: 0,
        customerName: name,
        phone: phone,
        email: email,
        notes: `[Subject: ${subject}] Message: ${message}`
      };

      if (!window.TaxiDB) return;

      try {
        await window.TaxiDB.addInquiry(msgData);
        contactAlert.className = 'alert alert-success';
        contactAlert.textContent = 'Inquiry sent! I will call you back shortly.';
        contactAlert.style.display = 'block';
        contactForm.reset();

        setTimeout(() => {
          contactAlert.style.display = 'none';
        }, 5000);
      } catch (err) {
        contactAlert.className = 'alert alert-danger';
        contactAlert.textContent = err.message || 'Could not send your message. Please try again.';
        contactAlert.style.display = 'block';
      }
    });
  }

  // Header Scroll Effect
  const header = document.querySelector('header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });
  }

  // Mobile Nav Toggle
  const navToggle = document.getElementById('nav-toggle');
  const navMobilePanel = document.getElementById('nav-mobile-panel');

  if (navToggle && navMobilePanel) {
    navToggle.addEventListener('click', () => {
      const isOpen = navMobilePanel.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      navToggle.innerHTML = isOpen ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
    });

    // Close the menu after tapping a link (nav link or one of the header buttons)
    navMobilePanel.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navMobilePanel.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.innerHTML = '<i class="fas fa-bars"></i>';
      });
    });
  }
});