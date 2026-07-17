(() => {
  'use strict';

  const ACCESS_KEY = 'melissa-antonio-wedding-access';
  const PASSWORD_HASH = 'a73c9fa2b21620050a6d9ea704aa3428e669f973db513cac7286843be49cb022';
  const gate = document.querySelector('#gate');
  const site = document.querySelector('#site');
  const passwordForm = document.querySelector('#password-form');
  const passwordInput = document.querySelector('#password');
  const passwordError = document.querySelector('#password-error');

  const sha256 = async (value) => {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
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

  if (localStorage.getItem(ACCESS_KEY) === 'granted') unlockSite(false);

  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    passwordError.textContent = '';
    const submittedHash = await sha256(passwordInput.value);

    if (submittedHash === PASSWORD_HASH) {
      localStorage.setItem(ACCESS_KEY, 'granted');
      passwordInput.value = '';
      unlockSite();
      return;
    }

    passwordError.textContent = 'Password non corretta';
    passwordForm.classList.remove('shake');
    void passwordForm.offsetWidth;
    passwordForm.classList.add('shake');
    passwordInput.select();
  });

  document.querySelector('#password-toggle').addEventListener('click', (event) => {
    const visible = passwordInput.type === 'text';
    passwordInput.type = visible ? 'password' : 'text';
    event.currentTarget.textContent = visible ? 'Mostra' : 'Nascondi';
    event.currentTarget.setAttribute('aria-label', visible ? 'Mostra password' : 'Nascondi password');
    passwordInput.focus();
  });

  document.querySelector('#lock-site').addEventListener('click', () => {
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
  const guestName = document.querySelector('#guest-name');
  const adultGuests = document.querySelector('#adult-guests');
  const childGuests = document.querySelector('#child-guests');
  const partyNamesField = document.querySelector('#party-names');
  const partyNamesRequirement = document.querySelector('#party-names-requirement');

  const updatePartyNamesRequirement = () => {
    const attendance = rsvpForm.querySelector('input[name="attendance"]:checked')?.value;
    const totalGuests = Number(adultGuests.value || 0) + Number(childGuests.value || 0);
    const partyNamesAreRequired = attendance !== 'Non potrò partecipare' && totalGuests > 1;

    partyNamesField.required = partyNamesAreRequired;
    partyNamesField.setAttribute('aria-required', String(partyNamesAreRequired));
    partyNamesRequirement.textContent = partyNamesAreRequired
      ? 'Obbligatorio perché il gruppo è composto da più persone.'
      : '';
  };

  const syncReferentCount = () => {
    if (guestName.value.trim() && Number(adultGuests.value) < 1) adultGuests.value = '1';
    updatePartyNamesRequirement();
  };
  guestName.addEventListener('input', syncReferentCount);
  guestName.addEventListener('change', syncReferentCount);
  adultGuests.addEventListener('input', updatePartyNamesRequirement);
  childGuests.addEventListener('input', updatePartyNamesRequirement);
  rsvpForm.querySelectorAll('input[name="attendance"]').forEach((field) => {
    field.addEventListener('change', updatePartyNamesRequirement);
  });
  updatePartyNamesRequirement();

  rsvpForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const prewedding = data.get('prewedding') || 'Non indicato';
    const partyNames = data.get('party-names')?.trim() || 'Nessun accompagnatore indicato';
    const notes = data.get('guest-notes')?.trim() || 'Nessuna';
    const message = [
      'Ciao Melissa e Antonio! 💙',
      '',
      `Sono ${data.get('guest-name')}.`,
      `Matrimonio: ${data.get('attendance')}.`,
      `Adulti: ${data.get('adult-guests')}.`,
      `Bambini: ${data.get('child-guests')}.`,
      `Accompagnatori: ${partyNames}.`,
      `Cena pre-wedding: ${prewedding}.`,
      `Allergie, intolleranze o altre richieste: ${notes}.`,
      '',
      'Non vedo l’ora di festeggiare con voi!'
    ].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
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
})();
