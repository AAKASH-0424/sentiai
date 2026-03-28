/**
 * auth.js --- Dummy Authentication for AI Review Analyzer
 * Features: modal open/close, tab switching, form validation,
 * simulated login (demo@ai.com / password123), signup, logout,
 * navbar scroll effect, and animated UI states.
 */

(function () {
  'use strict';

  /* ... Demo credentials ... */
  const DEMO_USER = { email: 'demo@ai.com', password: 'password123', name: 'Demo User' };
  let currentUser = null; // { name, email, initials }

  /* ... DOM refs ... */
  const overlay        = document.getElementById('auth-overlay');
  const modal          = document.getElementById('auth-modal');
  const closeBtn       = document.getElementById('auth-close');
  const indicator      = document.getElementById('auth-tab-indicator');

  // Tabs + panels
  const tabLogin       = document.getElementById('tab-login');
  const tabSignup      = document.getElementById('tab-signup');
  const panelLogin     = document.getElementById('panel-login');
  const panelSignup    = document.getElementById('panel-signup');

  // Login form
  const loginForm      = document.getElementById('login-form');
  const loginEmail     = document.getElementById('login-email');
  const loginPassword  = document.getElementById('login-password');
  const loginEmailErr  = document.getElementById('login-email-err');
  const loginPwErr     = document.getElementById('login-pw-err');
  const loginError     = document.getElementById('login-error');
  const loginSubmit    = document.getElementById('login-submit');
  const loginSpinner   = document.getElementById('login-spinner');
  const loginText      = document.getElementById('login-submit-text');
  const toggleLoginPw  = document.getElementById('toggle-login-pw');

  // Signup form
  const signupForm     = document.getElementById('signup-form');
  const signupName     = document.getElementById('signup-name');
  const signupEmail    = document.getElementById('signup-email');
  const signupPassword = document.getElementById('signup-password');
  const signupNameErr  = document.getElementById('signup-name-err');
  const signupEmailErr = document.getElementById('signup-email-err');
  const signupPwErr    = document.getElementById('signup-pw-err');
  const signupError    = document.getElementById('signup-error');
  const signupSubmit   = document.getElementById('signup-submit');
  const signupSpinner  = document.getElementById('signup-spinner');
  const signupText     = document.getElementById('signup-submit-text');
  const toggleSignupPw = document.getElementById('toggle-signup-pw');

  // Navbar nav actions area
  const navbarActions  = document.querySelector('.navbar__actions');
  const navbar         = document.getElementById('navbar');
  const hamburger      = document.getElementById('navbar-hamburger');
  const mobileMenu     = document.getElementById('navbar-mobile');

  /* ... Open / close modal ... */
  function openModal(tab = 'login') {
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    clearAllErrors();
    if (tab === 'signup') {
      switchTab('signup');
    } else {
      switchTab('login');
    }
    // Focus first input after animation
    requestAnimationFrame(() => {
      setTimeout(() => {
        const first = modal.querySelector('.auth-input');
        if (first) first.focus();
      }, 320);
    });
  }

  function closeModal() {
    overlay.hidden = true;
    document.body.style.overflow = '';
  }

  /* ... Tab switching ... */
  function switchTab(target) {
    if (target === 'login') {
      tabLogin.classList.add('auth-tab--active');
      tabSignup.classList.remove('auth-tab--active');
      tabLogin.setAttribute('aria-selected', 'true');
      tabSignup.setAttribute('aria-selected', 'false');
      panelLogin.hidden  = false;
      panelSignup.hidden = true;
      indicator.classList.remove('auth-tab__indicator--signup');
    } else {
      tabSignup.classList.add('auth-tab--active');
      tabLogin.classList.remove('auth-tab--active');
      tabSignup.setAttribute('aria-selected', 'true');
      tabLogin.setAttribute('aria-selected', 'false');
      panelSignup.hidden = false;
      panelLogin.hidden  = true;
      indicator.classList.add('auth-tab__indicator--signup');
    }
    clearAllErrors();
  }

  /* ... Field validation helpers ... */
  function validateEmail(val) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  }

  function setFieldError(input, errEl, msg) {
    errEl.textContent = msg;
    input.classList.add('is-error');
    input.classList.remove('is-success');
  }

  function setFieldOk(input, errEl) {
    errEl.textContent = '';
    input.classList.remove('is-error');
    if (input.value) input.classList.add('is-success');
  }

  function clearFieldState(input, errEl) {
    errEl.textContent = '';
    input.classList.remove('is-error', 'is-success');
  }

  function clearAllErrors() {
    [loginEmail, loginPassword].forEach(el => clearFieldState(el, el === loginEmail ? loginEmailErr : loginPwErr));
    loginError.hidden = true;
    [signupName, signupEmail, signupPassword].forEach(el => {
      const errMap = { [signupName.id]: signupNameErr, [signupEmail.id]: signupEmailErr, [signupPassword.id]: signupPwErr };
      clearFieldState(el, errMap[el.id]);
    });
    signupError.hidden = true;
  }

  /* ... Loading state on submit button ... */
  function setLoading(submitEl, spinnerEl, textEl, loading) {
    submitEl.disabled = loading;
    spinnerEl.classList.toggle('spinner--visible', loading);
    textEl.style.opacity = loading ? '0.6' : '1';
  }

  /* ... Simulate async call ... */
  function fakeAsync(ms = 900) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /* ... Login handler ... */
  async function handleLogin(e) {
    e.preventDefault();
    let valid = true;

    const email = loginEmail.value.trim();
    const pw    = loginPassword.value;

    if (!email) {
      setFieldError(loginEmail, loginEmailErr, 'Email is required');
      valid = false;
    } else if (!validateEmail(email)) {
      setFieldError(loginEmail, loginEmailErr, 'Enter a valid email address');
      valid = false;
    } else {
      setFieldOk(loginEmail, loginEmailErr);
    }

    if (!pw) {
      setFieldError(loginPassword, loginPwErr, 'Password is required');
      valid = false;
    } else if (pw.length < 6) {
      setFieldError(loginPassword, loginPwErr, 'Password must be at least 6 characters');
      valid = false;
    } else {
      setFieldOk(loginPassword, loginPwErr);
    }

    if (!valid) return;

    setLoading(loginSubmit, loginSpinner, loginText, true);
    loginError.hidden = true;

    await fakeAsync(800);

    // Dummy auth check
    if (email.toLowerCase() === DEMO_USER.email && pw === DEMO_USER.password) {
      loginIn({ name: DEMO_USER.name, email: DEMO_USER.email });
    } else if (email !== DEMO_USER.email) {
      // Any email + any password "signs up" and logs in for demo
      loginIn({ name: email.split('@')[0], email });
    } else {
      // Wrong password for demo account
      setLoading(loginSubmit, loginSpinner, loginText, false);
      loginError.hidden = false;
      loginError.textContent = '... Incorrect password. Try: password123';
      loginPassword.classList.add('is-error');
    }
  }

  /* ... Signup handler ... */
  async function handleSignup(e) {
    e.preventDefault();
    let valid = true;

    const name  = signupName.value.trim();
    const email = signupEmail.value.trim();
    const pw    = signupPassword.value;

    if (!name) {
      setFieldError(signupName, signupNameErr, 'Name is required');
      valid = false;
    } else if (name.length < 2) {
      setFieldError(signupName, signupNameErr, 'Name must be at least 2 characters');
      valid = false;
    } else {
      setFieldOk(signupName, signupNameErr);
    }

    if (!email) {
      setFieldError(signupEmail, signupEmailErr, 'Email is required');
      valid = false;
    } else if (!validateEmail(email)) {
      setFieldError(signupEmail, signupEmailErr, 'Enter a valid email address');
      valid = false;
    } else {
      setFieldOk(signupEmail, signupEmailErr);
    }

    if (!pw) {
      setFieldError(signupPassword, signupPwErr, 'Password is required');
      valid = false;
    } else if (pw.length < 8) {
      setFieldError(signupPassword, signupPwErr, 'Password must be at least 8 characters');
      valid = false;
    } else {
      setFieldOk(signupPassword, signupPwErr);
    }

    if (!valid) return;

    setLoading(signupSubmit, signupSpinner, signupText, true);
    signupError.hidden = true;

    await fakeAsync(1000);

    // Show success panel then log in
    showSignupSuccess(name, email);
  }

  /* ... Show signup success state ... */
  function showSignupSuccess(name, email) {
    panelSignup.innerHTML = `
      <div class="auth-success-banner">
        <div class="auth-success-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h2 class="auth-success-title">You're all set! ...</h2>
        <p class="auth-success-subtitle">Welcome to SentioAI, <strong>${escapeHtml(name)}</strong>!<br>Your account has been created.</p>
      </div>
    `;
    setTimeout(() => loginIn({ name, email }), 1400);
  }

  /* ... Log in: update navbar state ... */
  function loginIn(user) {
    currentUser = user;
    const initials = user.name
      .split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    // Replace navbar actions with user pill
    navbarActions.innerHTML = `
      <button class="navbar__user-pill" id="user-pill" title="Logged in as ${escapeHtml(user.email)}">
        <div class="navbar__avatar">${initials}</div>
        <span>${escapeHtml(user.name.split(' ')[0])}</span>
      </button>
      <button class="navbar__logout-btn" id="logout-btn" title="Log out">Log out</button>
    `;

    document.getElementById('logout-btn').addEventListener('click', logout);

    // Show toast
    showAuthToast(`Welcome back, ${user.name.split(' ')[0]}! ...`, 'success');

    closeModal();
  }

  /* ... Logout ... */
  function logout() {
    currentUser = null;
    navbarActions.innerHTML = `
      <button class="navbar__btn-login" id="btn-open-login" aria-label="Log in">Log in</button>
      <button class="navbar__btn-signup" id="btn-open-signup" aria-label="Sign up free">
        Sign Up Free
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 8h10M9 4l4 4-4 4"/>
        </svg>
      </button>
    `;
    // Re-bind
    document.getElementById('btn-open-login').addEventListener('click', () => openModal('login'));
    document.getElementById('btn-open-signup').addEventListener('click', () => openModal('signup'));
    showAuthToast('You\'ve been logged out', 'info');
  }

  /* ... Password toggle ... */
  function togglePasswordVisibility(inputEl) {
    inputEl.type = inputEl.type === 'password' ? 'text' : 'password';
  }

  /* ... Navbar scroll effect ... */
  function handleNavbarScroll() {
    if (window.scrollY > 10) {
      navbar.classList.add('navbar--scrolled');
    } else {
      navbar.classList.remove('navbar--scrolled');
    }
  }

  /* ... Custom toast (auth-specific) ... */
  function showAuthToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast--${type === 'success' ? 'success' : 'error'}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.4s ease';
      setTimeout(() => toast.remove(), 400);
    }, 3200);
  }

  /* ... XSS prevention ... */
  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ... Event bindings ... */
  function bindEvents() {
    // Open / close
    document.getElementById('btn-open-login')
      .addEventListener('click', () => openModal('login'));
    document.getElementById('btn-open-signup')
      .addEventListener('click', () => openModal('signup'));
    document.getElementById('hero-cta-signup')
      .addEventListener('click', () => openModal('signup'));
    document.getElementById('footer-login-btn')
      .addEventListener('click', () => openModal('login'));

    // Mobile
    if (document.getElementById('btn-open-login-mobile')) {
      document.getElementById('btn-open-login-mobile')
        .addEventListener('click', () => { closeMobileMenu(); openModal('login'); });
    }
    if (document.getElementById('btn-open-signup-mobile')) {
      document.getElementById('btn-open-signup-mobile')
        .addEventListener('click', () => { closeMobileMenu(); openModal('signup'); });
    }

    closeBtn.addEventListener('click', closeModal);

    // Overlay backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    // ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !overlay.hidden) closeModal();
    });

    // Tabs
    tabLogin.addEventListener('click',  () => switchTab('login'));
    tabSignup.addEventListener('click', () => switchTab('signup'));

    // Cross-links
    document.getElementById('switch-to-signup').addEventListener('click', () => switchTab('signup'));
    document.getElementById('switch-to-login').addEventListener('click',  () => switchTab('login'));

    // Forms
    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);

    // Password toggles
    toggleLoginPw.addEventListener('click',  () => togglePasswordVisibility(loginPassword));
    toggleSignupPw.addEventListener('click', () => togglePasswordVisibility(signupPassword));

    // Live validation (on blur)
    loginEmail.addEventListener('blur', () => {
      if (!loginEmail.value.trim()) {
        setFieldError(loginEmail, loginEmailErr, 'Email is required');
      } else if (!validateEmail(loginEmail.value)) {
        setFieldError(loginEmail, loginEmailErr, 'Enter a valid email address');
      } else {
        setFieldOk(loginEmail, loginEmailErr);
      }
    });

    loginEmail.addEventListener('input', () => clearFieldState(loginEmail, loginEmailErr));
    loginPassword.addEventListener('input', () => clearFieldState(loginPassword, loginPwErr));
    signupName.addEventListener('input', () => clearFieldState(signupName, signupNameErr));
    signupEmail.addEventListener('input', () => clearFieldState(signupEmail, signupEmailErr));
    signupPassword.addEventListener('input', () => clearFieldState(signupPassword, signupPwErr));

    // Forgot password (demo)
    document.getElementById('forgot-link').addEventListener('click', (e) => {
      e.preventDefault();
      showAuthToast('Password reset is disabled in demo mode', 'error');
    });

    // Navbar scroll
    window.addEventListener('scroll', handleNavbarScroll, { passive: true });
    handleNavbarScroll(); // init state

    // Hamburger
    hamburger.addEventListener('click', () => {
      const expanded = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', String(!expanded));
      mobileMenu.setAttribute('aria-hidden', String(expanded));
      mobileMenu.classList.toggle('is-open', !expanded);
    });
  }

  function closeMobileMenu() {
    hamburger.setAttribute('aria-expanded', 'false');
    mobileMenu.setAttribute('aria-hidden', 'true');
    mobileMenu.classList.remove('is-open');
  }

  /* ... Init ... */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }
})();

