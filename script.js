(() => {
  'use strict';

  const ACCESS_KEY = 'melissa-antonio-wedding-access';
  const DIRECTORY_KEY = 'melissa-antonio-directory-key';
  const PASSWORD_HASH = 'a73c9fa2b21620050a6d9ea704aa3428e669f973db513cac7286843be49cb022';
  const DIRECTORY_DATA = window.WEDDING_GUEST_DIRECTORY;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const gate = document.querySelector('#gate');
  const site = document.querySelector('#site');
  const passwordForm = document.querySelector('#password-form');
  const passwordInput = document.querySelector('#password');
  const passwordError = document.querySelector('#password-error');
  let guestDirectory = [];

  const base64ToBytes = (value) => Uint8Array.from(atob(value), character => character.charCodeAt(0));
  const bytesToBase64 = (value) => btoa(String.fromCharCode(...new Uint8Array(value)));

  const sha256 = async (value) => {
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  };

  const deriveDirectoryKey = async (password) => {
    const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: base64ToBytes(DIRECTORY_DATA.salt),
        iterations: DIRECTORY_DATA.iterations
      },
      material,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  };

  const decryptDirectory = async (key) => {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(DIRECTORY_DATA.iv) },
      key,
      base64ToBytes(DIRECTORY_DATA.ciphertext)
    );
    const names = JSON.parse(decoder.decode(plaintext));
    if (!Array.isArray(names) || names.some(name => typeof name !== 'string')) throw new Error('Invalid guest directory');
    return names;
  };

  const unlockSite = (animate = true) => {
    document.body.classList.remove('is-locked');
    site.removeAttribute('aria-hidden');
    site.classList.add('is-visible');
    if (animate) {
      gate.classList.add('is-leaving');
      window.setTimeout(() => { gate.hidden = true; }, 850);
    } else {
      gate.hidden = true;
    }
  };

  const restoreSession = async () => {
    const storedKey = sessionStorage.getItem(DIRECTORY_KEY);
    if (!storedKey || sessionStorage.getItem(ACCESS_KEY) !== 'granted') return;
    try {
      const key = await crypto.subtle.importKey('raw', base64ToBytes(storedKey), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
      guestDirectory = await decryptDirectory(key);
      unlockSite(false);
    } catch {
      sessionStorage.removeItem(ACCESS_KEY);
      sessionStorage.removeItem(DIRECTORY_KEY);
    }
  };

  localStorage.removeItem(ACCESS_KEY);
  void restoreSession();

  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    passwordError.textContent = '';
    const submittedPassword = passwordInput.value;
    const submitButton = passwordForm.querySelector('[type="submit"]');
    submitButton.disabled = true;

    try {
      const submittedHash = await sha256(submittedPassword);
      if (submittedHash !== PASSWORD_HASH) throw new Error('wrong-password');

      const key = await deriveDirectoryKey(submittedPassword);
      guestDirectory = await decryptDirectory(key);
      const rawKey = await crypto.subtle.exportKey('raw', key);
      sessionStorage.setItem(DIRECTORY_KEY, bytesToBase64(rawKey));
      sessionStorage.setItem(ACCESS_KEY, 'granted');
      passwordInput.value = '';
      unlockSite();
    } catch (error) {
      passwordError.textContent = error.message === 'wrong-password'
        ? 'Password non corretta'
        : 'Non è stato possibile aprire l’invito. Riprova.';
      passwordForm.classList.remove('shake');
      void passwordForm.offsetWidth;
      passwordForm.classList.add('shake');
      passwordInput.select();
    } finally {
      submitButton.disabled = false;
    }
  });

  document.querySelector('#password-toggle').addEventListener('click', (event) => {
    const visible = passwordInput.type === 'text';
    passwordInput.type = visible ? 'password' : 'text';
    event.currentTarget.textContent = visible ? 'Mostra' : 'Nascondi';
    event.currentTarget.setAttribute('aria-label', visible ? 'Mostra password' : 'Nascondi password');
    passwordInput.focus();
  });

  document.querySelector('#lock-site').addEventListener('click', () => {
    sessionStorage.removeItem(ACCESS_KEY);
    sessionStorage.removeItem(DIRECTORY_KEY);
    localStorage.removeItem(ACCESS_KEY);
    window.scrollTo({ top: 0, behavior: 'auto' });
    window.location.reload();
  });

  const topbar = document.querySelector('#topbar');
  const menuToggle = document.querySelector('#menu-toggle');
  const nav = document.querySelector('#site-nav');

  menuToggle.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('is-open', !open);
    document.body.classList.toggle('is-locked', !open);
  });

  nav.addEventListener('click', (event) => {
    if (!event.target.closest('a')) return;
    menuToggle.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
    document.body.classList.remove('is-locked');
  });

  const onScroll = () => topbar.classList.toggle('is-scrolled', window.scrollY > 20);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        currentObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -30px' });
    revealItems.forEach(item => observer.observe(item));
  } else {
    revealItems.forEach(item => item.classList.add('is-revealed'));
  }

  const weddingDate = new Date('2026-09-26T15:00:00+02:00').getTime();
  const countdownFields = {
    days: document.querySelector('#days'),
    hours: document.querySelector('#hours'),
    minutes: document.querySelector('#minutes'),
    seconds: document.querySelector('#seconds')
  };

  const updateCountdown = () => {
    const remaining = Math.max(0, weddingDate - Date.now());
    const values = {
      days: Math.floor(remaining / 86400000),
      hours: Math.floor((remaining % 86400000) / 3600000),
      minutes: Math.floor((remaining % 3600000) / 60000),
      seconds: Math.floor((remaining % 60000) / 1000)
    };
    Object.entries(values).forEach(([key, value]) => {
      countdownFields[key].textContent = String(value).padStart(2, '0');
    });
  };
  updateCountdown();
  window.setInterval(updateCountdown, 1000);

  const rsvpForm = document.querySelector('#rsvp-form');
  const guestList = document.querySelector('#rsvp-guest-list');
  const searchPanel = document.querySelector('#adult-search-panel');
  const searchInput = document.querySelector('#adult-search');
  const searchResults = document.querySelector('#adult-search-results');
  const manualFields = document.querySelector('#manual-adult-fields');
  const firstNameInput = document.querySelector('#manual-first-name');
  const lastNameInput = document.querySelector('#manual-last-name');
  const addChildButton = document.querySelector('#add-child');
  const closeSearchButton = document.querySelector('#close-adult-search');
  const groupCount = document.querySelector('#rsvp-group-count');
  const rsvpStatus = document.querySelector('#rsvp-status');
  const guests = [];
  let nextGuestId = 1;

  const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);

  const normalizeText = (value) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘`]/g, "'")
    .toLocaleLowerCase('it')
    .trim();

  const selectOptions = (values, selected, prompt = 'Seleziona') => [
    `<option value="">${prompt}</option>`,
    ...values.map(([value, label]) => `<option value="${value}"${selected === value ? ' selected' : ''}>${label}</option>`)
  ].join('');

  const setRsvpStatus = (message, isError = false) => {
    rsvpStatus.textContent = message;
    rsvpStatus.classList.toggle('is-error', isError);
  };

  const renderGuests = () => {
    let childNumber = 0;
    guestList.innerHTML = guests.map((guest) => {
      if (guest.type === 'child') childNumber += 1;
      const title = guest.type === 'child' ? `Bambino ${childNumber}` : escapeHtml(guest.name);
      const identityFields = guest.type === 'child' ? `
        <div class="guest-details">
          <div class="guest-field">
            <label for="guest-name-${guest.id}">Nome e cognome</label>
            <input id="guest-name-${guest.id}" class="guest-name" type="text" value="${escapeHtml(guest.name)}" placeholder="Nome e cognome" autocomplete="name">
          </div>
          <div class="guest-field">
            <label for="guest-age-${guest.id}">Età</label>
            <input id="guest-age-${guest.id}" class="guest-age" type="number" min="0" max="17" inputmode="numeric" value="${escapeHtml(guest.age)}" placeholder="Età">
          </div>
        </div>` : '';
      const childNeeds = guest.type === 'child' ? `
          <div class="guest-field">
            <label for="guest-needs-${guest.id}">Necessità del bambino</label>
            <input id="guest-needs-${guest.id}" class="guest-needs" type="text" value="${escapeHtml(guest.needs)}" placeholder="Es. seggiolino">
          </div>` : '';

      return `
        <article class="rsvp-guest-card" data-guest-id="${guest.id}">
          <div class="guest-card__heading">
            <div>
              <h3>${title}</h3>
              ${guest.type === 'child' ? '<p>Inserite i dati del bambino</p>' : ''}
            </div>
            <button class="guest-remove remove-guest" type="button">Rimuovi</button>
          </div>
          ${identityFields}
          <div class="guest-fields">
            <div class="guest-field">
              <label for="guest-wedding-${guest.id}">Matrimonio</label>
              <select id="guest-wedding-${guest.id}" class="guest-wedding">${selectOptions([['yes', 'Partecipa'], ['no', 'Non partecipa']], guest.wedding)}</select>
            </div>
            <div class="guest-field">
              <label for="guest-dinner-${guest.id}">Cena pre-wedding</label>
              <select id="guest-dinner-${guest.id}" class="guest-dinner">${selectOptions([['yes', 'Partecipa'], ['no', 'Non partecipa']], guest.dinner)}</select>
            </div>
            <div class="guest-field">
              <label for="guest-nights-${guest.id}">Pernottamento</label>
              <select id="guest-nights-${guest.id}" class="guest-nights">${selectOptions([['0', '0 notti'], ['1', '1 notte · 26–27 settembre'], ['2', '2 notti · 25–27 settembre']], guest.nights)}</select>
            </div>
          </div>
          <div class="guest-details${guest.type === 'adult' ? ' guest-details--single' : ''}">
            <div class="guest-field">
              <label for="guest-allergies-${guest.id}">Allergie o intolleranze</label>
              <input id="guest-allergies-${guest.id}" class="guest-allergies" type="text" value="${escapeHtml(guest.allergies)}" placeholder="Nessuna">
            </div>
            ${childNeeds}
          </div>
          <button class="apply-group" type="button">Applica matrimonio, cena e pernottamento a tutto il gruppo</button>
        </article>`;
    }).join('');

    const adultCount = guests.filter(guest => guest.type === 'adult').length;
    const childCount = guests.filter(guest => guest.type === 'child').length;
    addChildButton.disabled = adultCount === 0;
    closeSearchButton.hidden = adultCount === 0;
    groupCount.textContent = guests.length === 0
      ? 'Nessuna persona aggiunta'
      : `${adultCount} ${adultCount === 1 ? 'adulto' : 'adulti'} · ${childCount} ${childCount === 1 ? 'bambino' : 'bambini'}`;
  };

  const readGuestCard = (card) => {
    const guest = guests.find(item => item.id === Number(card.dataset.guestId));
    if (!guest) return;
    guest.wedding = card.querySelector('.guest-wedding').value;
    guest.dinner = card.querySelector('.guest-dinner').value;
    guest.nights = card.querySelector('.guest-nights').value;
    guest.allergies = card.querySelector('.guest-allergies').value.trim();
    if (guest.type === 'child') {
      guest.name = card.querySelector('.guest-name').value.trim();
      guest.age = card.querySelector('.guest-age').value;
      guest.needs = card.querySelector('.guest-needs').value.trim();
    }
  };

  const clearSearch = () => {
    searchInput.value = '';
    searchResults.innerHTML = '';
    firstNameInput.value = '';
    lastNameInput.value = '';
    manualFields.hidden = true;
  };

  const openSearch = () => {
    searchPanel.hidden = false;
    clearSearch();
    searchInput.focus({ preventScroll: true });
    searchPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const addAdult = (name, manual = false) => {
    const normalizedName = normalizeText(name);
    if (guests.some(guest => guest.type === 'adult' && normalizeText(guest.name) === normalizedName)) {
      setRsvpStatus('Questa persona è già stata aggiunta al gruppo.', true);
      return;
    }
    guests.push({
      id: nextGuestId++, type: 'adult', name: name.trim(), manual,
      wedding: '', dinner: '', nights: '', age: '', allergies: '', needs: ''
    });
    searchPanel.hidden = true;
    clearSearch();
    renderGuests();
    setRsvpStatus(`${name.trim()} è stato aggiunto al gruppo.`);
  };

  const renderSearchResults = () => {
    const query = normalizeText(searchInput.value);
    searchResults.innerHTML = '';
    if (!query) return;

    const selectedNames = new Set(guests.filter(guest => guest.type === 'adult').map(guest => normalizeText(guest.name)));
    const exactMatch = guestDirectory.find(name => normalizeText(name) === query);

    if (!exactMatch) {
      searchResults.innerHTML = '<p class="search-message">Inserite il nome e il cognome completi per verificare il nominativo.</p>';
      return;
    }

    if (selectedNames.has(normalizeText(exactMatch))) {
      searchResults.innerHTML = '<p class="search-message">Questa persona è già presente nel gruppo.</p>';
      return;
    }

    const button = document.createElement('button');
    button.className = 'adult-search-result';
    button.type = 'button';
    button.role = 'option';
    button.textContent = exactMatch;
    button.addEventListener('click', () => addAdult(exactMatch));
    searchResults.append(button);
  };

  document.querySelector('#add-adult').addEventListener('click', openSearch);
  closeSearchButton.addEventListener('click', () => {
    searchPanel.hidden = true;
    clearSearch();
  });
  searchInput.addEventListener('input', renderSearchResults);

  document.querySelector('#show-manual-adult').addEventListener('click', () => {
    manualFields.hidden = false;
    firstNameInput.focus();
  });

  document.querySelector('#confirm-manual-adult').addEventListener('click', () => {
    const firstName = firstNameInput.value.trim();
    const lastName = lastNameInput.value.trim();
    if (!firstName || !lastName) {
      setRsvpStatus('Inserite nome e cognome dell’adulto.', true);
      (!firstName ? firstNameInput : lastNameInput).focus();
      return;
    }
    addAdult(`${firstName} ${lastName}`, true);
  });

  addChildButton.addEventListener('click', () => {
    guests.push({
      id: nextGuestId++, type: 'child', name: '', manual: true,
      wedding: '', dinner: '', nights: '', age: '', allergies: '', needs: ''
    });
    renderGuests();
    setRsvpStatus('Bambino aggiunto. Completate i suoi dati.');
    guestList.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  guestList.addEventListener('input', (event) => {
    const card = event.target.closest('[data-guest-id]');
    if (card) readGuestCard(card);
  });

  guestList.addEventListener('change', (event) => {
    const card = event.target.closest('[data-guest-id]');
    if (card) readGuestCard(card);
  });

  guestList.addEventListener('click', (event) => {
    const card = event.target.closest('[data-guest-id]');
    if (!card) return;
    readGuestCard(card);
    const guest = guests.find(item => item.id === Number(card.dataset.guestId));
    if (!guest) return;

    if (event.target.closest('.remove-guest')) {
      const adultCount = guests.filter(item => item.type === 'adult').length;
      if (guest.type === 'adult' && adultCount === 1) {
        setRsvpStatus('Il gruppo deve contenere almeno un adulto. Aggiungetene un altro prima di rimuovere questo nome.', true);
        return;
      }
      guests.splice(guests.indexOf(guest), 1);
      renderGuests();
      setRsvpStatus('Persona rimossa dal gruppo.');
      return;
    }

    if (event.target.closest('.apply-group')) {
      if (!guest.wedding || !guest.dinner || guest.nights === '') {
        setRsvpStatus('Selezionate prima matrimonio, cena e pernottamento per questa persona.', true);
        card.querySelector('select:invalid, select')?.focus();
        return;
      }
      guests.forEach(item => {
        item.wedding = guest.wedding;
        item.dinner = guest.dinner;
        item.nights = guest.nights;
      });
      renderGuests();
      setRsvpStatus(`Scelte applicate a ${guests.length} persone. Potete ancora modificarle singolarmente.`);
    }
  });

  const validateRsvp = () => {
    guestList.querySelectorAll('[data-guest-id]').forEach(readGuestCard);
    if (!guests.some(guest => guest.type === 'adult')) {
      setRsvpStatus('Aggiungete almeno un adulto per continuare.', true);
      openSearch();
      return false;
    }

    for (const guest of guests) {
      const card = guestList.querySelector(`[data-guest-id="${guest.id}"]`);
      if (guest.type === 'child' && !guest.name) {
        setRsvpStatus('Inserite il nome e cognome di ogni bambino.', true);
        card.querySelector('.guest-name').focus();
        return false;
      }
      if (guest.type === 'child' && guest.age === '') {
        setRsvpStatus(`Indicate l’età di ${guest.name || 'ogni bambino'}.`, true);
        card.querySelector('.guest-age').focus();
        return false;
      }
      if (!guest.wedding || !guest.dinner || guest.nights === '') {
        setRsvpStatus(`Completate matrimonio, cena e pernottamento per ${guest.name || 'ogni persona'}.`, true);
        const missingField = !guest.wedding ? '.guest-wedding' : !guest.dinner ? '.guest-dinner' : '.guest-nights';
        card.querySelector(missingField).focus();
        return false;
      }
    }
    return true;
  };

  rsvpForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!validateRsvp()) return;

    const lodgingLabels = {
      '0': '0 notti',
      '1': '1 notte (26–27 settembre)',
      '2': '2 notti (25–27 settembre)'
    };
    const lines = [
      'Ciao Melissa e Antonio! 💙',
      '',
      'Ecco il nostro RSVP:',
      ''
    ];

    guests.forEach((guest, index) => {
      lines.push(`${index + 1}. ${guest.name}${guest.type === 'child' ? ` — bambino, ${guest.age} ${guest.age === '1' ? 'anno' : 'anni'}` : ''}`);
      lines.push(`   Matrimonio: ${guest.wedding === 'yes' ? 'Partecipa' : 'Non partecipa'}`);
      lines.push(`   Cena pre-wedding: ${guest.dinner === 'yes' ? 'Partecipa' : 'Non partecipa'}`);
      lines.push(`   Pernottamento: ${lodgingLabels[guest.nights]}`);
      lines.push(`   Allergie o intolleranze: ${guest.allergies || 'Nessuna'}`);
      if (guest.type === 'child') lines.push(`   Necessità del bambino: ${guest.needs || 'Nessuna'}`);
      lines.push('');
    });

    const generalNote = document.querySelector('#general-note').value.trim();
    lines.push(`Note o messaggio: ${generalNote || 'Nessuno'}`);
    lines.push('', 'Un abbraccio!');
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
  });

  const copyIbanButton = document.querySelector('#copy-iban');
  copyIbanButton.addEventListener('click', async () => {
    const iban = document.querySelector('#iban-value').textContent.trim();
    const status = document.querySelector('#iban-copy-status');
    try {
      await navigator.clipboard.writeText(iban);
      status.textContent = 'IBAN copiato';
    } catch {
      status.textContent = 'Seleziona e copia il codice qui sopra';
    }
  });

  renderGuests();
})();
