import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import LandingPage from './LandingPage';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// IntersectionObserver is not available in jsdom — must be a proper constructor
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(_callback: IntersectionObserverCallback) {}
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

// fetch for auth form submissions
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const renderPage = () =>
  render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  );

/** Opens the login modal via the nav Login button. */
const openLoginModal = () =>
  fireEvent.click(screen.getByRole('button', { name: /^login$/i }));

/** Opens the register modal via the nav Get Started button. */
const openRegisterModal = () =>
  fireEvent.click(screen.getByRole('button', { name: /get started/i }));

/**
 * The modal panel — scoped queries are more reliable than global screen queries
 * when there are similarly-named elements outside the modal.
 */
const getModalPanel = () =>
  document.querySelector('[data-testid="modal-panel"]') as HTMLElement;

/** The first button in the modal panel is always the icon-only close (×) button. */
const getCloseButton = () => within(getModalPanel()).getAllByRole('button')[0];

/** Login identifier input (username/email) uses the email-like placeholder. */
const getLoginIdentifierInput = () => screen.getByPlaceholderText('legal.professional@firm.com');

/** Register username input uses the username placeholder. */
const getRegisterUsernameInput = () => screen.getByPlaceholderText('legal.professional');

/** Register email input uses the email placeholder. */
const getRegisterEmailInput = () => screen.getByPlaceholderText('legal.professional@firm.com');

/**
 * Password inputs have type="password" which has no ARIA role textbox,
 * so we query by attribute. Returns all password inputs currently in the DOM.
 */
const getPasswordInputs = () =>
  Array.from(document.querySelectorAll('input[type="password"]')) as HTMLInputElement[];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LandingPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockFetch.mockClear();
  });

  // ── Page sections ────────────────────────────────────────────────────────

  describe('Page sections', () => {
    it('renders the main marketing headline', () => {
      renderPage();
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByText(/AI Legal Research/i)).toBeInTheDocument();
    });

    it('renders the navigation bar with Login and Get Started buttons', () => {
      renderPage();
      expect(screen.getByRole('button', { name: /^login$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
    });

    it('renders the Request Demo button in the hero section', () => {
      renderPage();
      expect(screen.getByRole('button', { name: /request demo/i })).toBeInTheDocument();
    });

    it('renders the Start Free Trial button in the CTA section', () => {
      renderPage();
      expect(screen.getByRole('button', { name: /start free trial/i })).toBeInTheDocument();
    });

    it('renders navigation links for key sections', () => {
      renderPage();
      expect(screen.getByRole('link', { name: /features/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /solutions/i })).toBeInTheDocument();
    });

    it('renders a trust indicator showing the number of global law firms', () => {
      renderPage();
      // "200+" appears in a <strong> element inside the trust badge
      expect(screen.getByText('200+')).toBeInTheDocument();
    });
  });

  // ── Auth modal not shown by default ─────────────────────────────────────

  describe('Auth modal — initial state', () => {
    it('does not show any auth form on initial render', () => {
      renderPage();
      expect(document.querySelectorAll('input[type="email"]')).toHaveLength(0);
      expect(document.querySelectorAll('input[type="password"]')).toHaveLength(0);
    });
  });

  // ── Opening the auth modal ───────────────────────────────────────────────

  describe('Auth modal — opening', () => {
    it('opens the login form when the nav Login button is clicked', () => {
      renderPage();
      openLoginModal();
      // Login form has a Sign In submit and a Create Account switch link
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    });

    it('opens the register form when the nav Get Started button is clicked', () => {
      renderPage();
      openRegisterModal();
      // Register form has a Create Account submit and two password fields
      expect(screen.getByRole('button', { name: /^create account$/i })).toBeInTheDocument();
      expect(getPasswordInputs()).toHaveLength(2);
    });

    it('opens the register form when Request Demo is clicked', () => {
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: /request demo/i }));
      expect(screen.getByRole('button', { name: /^create account$/i })).toBeInTheDocument();
    });

    it('opens the register form when Start Free Trial is clicked', () => {
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: /start free trial/i }));
      expect(screen.getByRole('button', { name: /^create account$/i })).toBeInTheDocument();
    });
  });

  // ── Closing the auth modal ───────────────────────────────────────────────

  describe('Auth modal — closing', () => {
    it('closes the modal when the × button is clicked', () => {
      renderPage();
      openLoginModal();
      expect(getLoginIdentifierInput()).toBeInTheDocument();

      fireEvent.click(getCloseButton());

      expect(document.querySelectorAll('input[type="email"]')).toHaveLength(0);
    });

    it('closes the modal when the backdrop overlay is clicked', () => {
      renderPage();
      openLoginModal();
      expect(getLoginIdentifierInput()).toBeInTheDocument();

      // The outermost modal div handles backdrop clicks; clicking it directly triggers onClose
      fireEvent.click(document.querySelector('.fixed.inset-0') as HTMLElement);

      expect(document.querySelectorAll('input[type="email"]')).toHaveLength(0);
    });

    it('keeps the modal open when clicking inside the modal panel', () => {
      renderPage();
      openLoginModal();

      // Inner panel has stopPropagation — clicking it must NOT close the modal
      fireEvent.click(getModalPanel());

      expect(getLoginIdentifierInput()).toBeInTheDocument();
    });
  });

  // ── Switching between login and register ─────────────────────────────────

  describe('Auth modal — switching views', () => {
    it('switches from login to register when the Create Account link is clicked', () => {
      renderPage();
      openLoginModal();

      // Initially showing login (one password field, no confirm field)
      expect(getPasswordInputs()).toHaveLength(1);
      expect(screen.queryByText(/confirm password/i)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      // Now showing register (two password fields, confirm label visible)
      expect(getPasswordInputs()).toHaveLength(2);
      expect(screen.getByText(/confirm password/i)).toBeInTheDocument();
    });

    it('switches from register to login when the Sign In link is clicked', () => {
      renderPage();
      openRegisterModal();

      expect(getPasswordInputs()).toHaveLength(2);

      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

      // Back on login — one password field, no confirm
      expect(getPasswordInputs()).toHaveLength(1);
      expect(screen.queryByText(/confirm password/i)).not.toBeInTheDocument();
    });
  });

  // ── Login form behaviour ─────────────────────────────────────────────────

  describe('Login form', () => {
    it('shows an error message when credentials are rejected by the server', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false } as Response);
      renderPage();
      openLoginModal();

      fireEvent.change(getLoginIdentifierInput(), { target: { value: 'user@firm.com' } });
      fireEvent.change(getPasswordInputs()[0], { target: { value: 'wrongpass' } });
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() => {
        expect(screen.getByText(/email or password incorrect/i)).toBeInTheDocument();
      });
    });

    it('navigates to /workspace on successful login', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'test-token' }),
      } as Response);

      renderPage();
      openLoginModal();

      fireEvent.change(getLoginIdentifierInput(), { target: { value: 'user@firm.com' } });
      fireEvent.change(getPasswordInputs()[0], { target: { value: 'correctpass' } });
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/workspace');
      });
    });

    it('closes the modal after a successful login', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'test-token' }),
      } as Response);

      renderPage();
      openLoginModal();

      fireEvent.change(getLoginIdentifierInput(), { target: { value: 'user@firm.com' } });
      fireEvent.change(getPasswordInputs()[0], { target: { value: 'correctpass' } });
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() => {
        expect(document.querySelectorAll('input[type="email"]')).toHaveLength(0);
      });
    });

    it('stores the auth token in localStorage on successful login', async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'jwt-abc-123' }),
      } as Response);

      renderPage();
      openLoginModal();

      fireEvent.change(getLoginIdentifierInput(), { target: { value: 'user@firm.com' } });
      fireEvent.change(getPasswordInputs()[0], { target: { value: 'pass' } });
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() => {
        expect(setItemSpy).toHaveBeenCalledWith('token', 'jwt-abc-123');
      });
    });

    it('does not show a password toggle until the user starts typing', () => {
      renderPage();
      openLoginModal();

      // No toggle visible with empty password
      expect(screen.queryByAltText(/toggle password/i)).not.toBeInTheDocument();

      fireEvent.change(getPasswordInputs()[0], { target: { value: 's' } });

      expect(screen.getByAltText(/toggle password/i)).toBeInTheDocument();
    });

    it('reveals the password text when the visibility toggle is clicked', () => {
      renderPage();
      openLoginModal();

      const passwordInput = getPasswordInputs()[0];
      fireEvent.change(passwordInput, { target: { value: 'secret' } });

      expect(passwordInput).toHaveAttribute('type', 'password');
      fireEvent.click(screen.getByAltText(/toggle password/i));
      expect(passwordInput).toHaveAttribute('type', 'text');
    });

    it('hides the password again when the toggle is clicked a second time', () => {
      renderPage();
      openLoginModal();

      const passwordInput = getPasswordInputs()[0];
      fireEvent.change(passwordInput, { target: { value: 'secret' } });

      const toggle = screen.getByAltText(/toggle password/i);
      fireEvent.click(toggle);
      fireEvent.click(toggle);

      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  // ── Register form behaviour ──────────────────────────────────────────────

  describe('Register form', () => {
    const fillRegisterForm = (password: string, confirmPassword: string) => {
      fireEvent.change(getRegisterUsernameInput(), { target: { value: 'newuser' } });
      fireEvent.change(getRegisterEmailInput(), { target: { value: 'newuser@firm.com' } });
      const [pwdInput, confirmInput] = getPasswordInputs();
      fireEvent.change(pwdInput, { target: { value: password } });
      fireEvent.change(confirmInput, { target: { value: confirmPassword } });
    };

    it('shows an error when the two passwords do not match', () => {
      renderPage();
      openRegisterModal();

      fillRegisterForm('password123', 'different456');
      fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });

    it('does not navigate when passwords do not match', () => {
      renderPage();
      openRegisterModal();

      fillRegisterForm('password123', 'different456');
      fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('navigates to /workspace when passwords match', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, text: async () => '' } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: 'test-token' }),
        } as Response);
      renderPage();
      openRegisterModal();

      fillRegisterForm('mypassword', 'mypassword');
      fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/workspace');
      });
    });

    it('closes the modal after successful registration', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, text: async () => '' } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: 'test-token' }),
        } as Response);
      renderPage();
      openRegisterModal();

      fillRegisterForm('mypassword', 'mypassword');
      fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

      await waitFor(() => {
        expect(document.querySelectorAll('input[type="email"]')).toHaveLength(0);
      });
    });

    it('clears the mismatch error once the user fixes the passwords and resubmits', () => {
      renderPage();
      openRegisterModal();

      fillRegisterForm('abc', 'xyz');
      fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();

      // Correct the second password and resubmit
      fireEvent.change(getPasswordInputs()[1], { target: { value: 'abc' } });
      fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

      expect(screen.queryByText(/passwords do not match/i)).not.toBeInTheDocument();
    });
  });

  // ── Animation timers ─────────────────────────────────────────────────────
  // Fake timers are scoped here so they don't break waitFor in async tests above.

  describe('Page animations', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('nav bar starts hidden and becomes visible after its reveal delay', () => {
      renderPage();
      const nav = document.querySelector('nav') as HTMLElement;
      expect(nav).toHaveClass('opacity-0');

      act(() => { vi.advanceTimersByTime(200); });

      expect(nav).toHaveClass('opacity-100');
    });

    it('cleans up all animation timers when the component unmounts', () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
      const { unmount } = renderPage();
      unmount();
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });
});
