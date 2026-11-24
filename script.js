/*
  BiegPlan – zachowanie strony.
  1. CTA: sygnał cta_click przy każdym rzeczywistym kliknięciu (parametr cta_location).
  2. Formularz: form_start przy pierwszej zmianie pola, walidacja po stronie przeglądarki,
     form_error (nazwa pola, bez wartości) przy nieudanej próbie,
     lead_success najwyżej raz na wyświetlenie strony – tylko w gałęzi poprawnego sukcesu.
  Do dataLayer nigdy nie trafiają wartości wpisane w pola.
  Formularz niczego nie wysyła: brak fetch/XHR, a pola nie mają atrybutu name.
*/
(function () {
  'use strict';

  window.dataLayer = window.dataLayer || [];

  var FORM_ID = 'lead-form';
  var form = document.getElementById(FORM_ID);
  var submitBtn = document.getElementById('lead-submit');
  var statusBox = document.getElementById('form-status');

  var formStarted = false;   // form_start tylko raz na wyświetlenie strony
  var leadSent = false;      // lead_success tylko raz na wyświetlenie strony
  var triedSubmit = false;   // po pierwszej próbie walidujemy pola na bieżąco

  /* ---------- 1. Kliknięcia CTA ---------- */
  var ctas = document.querySelectorAll('[data-cta-location]');
  Array.prototype.forEach.call(ctas, function (cta) {
    cta.addEventListener('click', function () {
      window.dataLayer.push({
        event: 'cta_click',
        cta_location: cta.getAttribute('data-cta-location')
      });
    });
  });

  /* ---------- 2. Reguły walidacji ---------- */
  // Każda reguła zwraca pusty tekst (pole poprawne) albo treść błędu.
  var rules = {
    email: function (v) {
      if (!v) return 'Wpisz adres e-mail.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Wpisz adres w formacie nazwa@domena.pl, np. test@example.com.';
      return '';
    },
    rekord: function (v) {
      if (!v) return 'Wpisz swój rekord w półmaratonie.';
      var m = /^(\d):([0-5]\d):([0-5]\d)$/.exec(v);
      if (!m) return 'Wpisz czas w formacie g:mm:ss, np. 1:52:30.';
      var sec = (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]);
      if (sec < 65 * 60 || sec > 210 * 60) return 'Wpisz czas od 1:05:00 do 3:30:00.';
      return '';
    },
    dni: function (v) {
      if (!v) return 'Wybierz liczbę dni treningowych.';
      return '';
    }
  };
  var fieldIds = Object.keys(rules);

  function showFieldError(id, message) {
    var input = document.getElementById(id);
    var error = document.getElementById(id + '-error');
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      error.textContent = message;
      error.hidden = false;
    } else {
      input.removeAttribute('aria-invalid');
      error.textContent = '';
      error.hidden = true;
    }
  }

  function validateField(id) {
    var value = document.getElementById(id).value.trim();
    var message = rules[id](value);
    showFieldError(id, message);
    return message === '';
  }

  /* ---------- 3. Rozpoczęcie formularza ---------- */
  function onFieldChange(e) {
    if (!formStarted) {
      formStarted = true;
      window.dataLayer.push({ event: 'form_start', form_id: FORM_ID });
    }
    if (triedSubmit && !leadSent) validateField(e.target.id);
  }
  form.addEventListener('input', onFieldChange);
  form.addEventListener('change', onFieldChange);

  /* ---------- 4. Wysłanie (symulacja) ---------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();               // brak żądania do serwera i zmian w URL

    if (leadSent) return;             // drugi sukces w tym wyświetleniu jest niemożliwy
    triedSubmit = true;

    // WALIDACJA: tu sprawdzamy wszystkie pola.
    var invalid = fieldIds.filter(function (id) { return !validateField(id); });

    if (invalid.length > 0) {
      statusBox.className = 'form-status is-error';
      statusBox.textContent = 'Popraw zaznaczone pola i wyślij ponownie.';
      invalid.forEach(function (id) {
        // Własne zdarzenie: tylko nazwa pola, nigdy wpisana wartość.
        window.dataLayer.push({ event: 'form_error', form_id: FORM_ID, field_name: id });
      });
      document.getElementById(invalid[0]).focus();
      return;                         // błąd => brak lead_success
    }

    // SUKCES: wszystkie pola poprawne. Dopiero tutaj wysyłamy sygnał lead_success.
    leadSent = true;
    submitBtn.disabled = true;
    fieldIds.forEach(function (id) { document.getElementById(id).disabled = true; });

    statusBox.className = 'form-status is-success';
    statusBox.textContent = 'Demonstracja zakończona — dane nie zostały wysłane.';

    window.dataLayer.push({ event: 'lead_success', form_id: FORM_ID });
  });

  /* ---------- 5. Zmiana zgód ---------- */
  // Na spotkaniu 3 podłączymy CMP. Dla Cookiebota otwiera to okno ponownego wyboru zgód.
  var consentLink = document.getElementById('consent-settings');
  if (consentLink) {
    consentLink.addEventListener('click', function (e) {
      e.preventDefault();
      if (window.Cookiebot && typeof window.Cookiebot.renew === 'function') {
        window.Cookiebot.renew();
      }
    });
  }
})();
