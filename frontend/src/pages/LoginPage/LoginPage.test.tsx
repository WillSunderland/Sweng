import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './LoginPage';

const mockNavigate = vi.fn();
const mockFetch = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderLoginPage = () =>
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );

describe('LoginPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockFetch.mockReset();
    localStorage.clear();
    vi.stubGlobal('fetch', mockFetch);
  });

  it('renders login form controls', () => {
    renderLoginPage();
    expect(screen.getByPlaceholderText('legal.professional@firm.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^create account$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /forgot password/i })).toBeInTheDocument();
  });

  it('navigates to forgot password page', () => {
    renderLoginPage();
    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/forgot-password');
  });

  it('navigates to register page', () => {
    renderLoginPage();
    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/register');
  });

  it('shows error for invalid credentials', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false } as Response);

    renderLoginPage();
    fireEvent.change(screen.getByPlaceholderText('legal.professional@firm.com'), {
      target: { value: 'user@firm.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('········'), {
      target: { value: 'wrongpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByText(/email or password incorrect/i)).toBeInTheDocument();
    });
  });

  it('stores auth token and navigates to workspace on success', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'jwt-abc-123' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ username: 'user@firm.com' }),
      } as Response);

    renderLoginPage();
    fireEvent.change(screen.getByPlaceholderText('legal.professional@firm.com'), {
      target: { value: 'user@firm.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('········'), {
      target: { value: 'correctpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => {
      expect(setItemSpy).toHaveBeenCalledWith('token', 'jwt-abc-123');
      expect(mockNavigate).toHaveBeenCalledWith('/workspace');
    });
  });

  it('shows password toggle only after typing', () => {
    renderLoginPage();
    expect(screen.queryByAltText(/toggle password/i)).not.toBeInTheDocument();

    const passwordInput = screen.getByPlaceholderText('········');
    fireEvent.change(passwordInput, { target: { value: 'secret' } });

    expect(screen.getByAltText(/toggle password/i)).toBeInTheDocument();
  });

  it('toggles password visibility when icon is clicked', () => {
    renderLoginPage();
    const passwordInput = screen.getByPlaceholderText('········');
    fireEvent.change(passwordInput, { target: { value: 'secret' } });

    const toggle = screen.getByAltText(/toggle password/i);
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(toggle);
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(toggle);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });
});
