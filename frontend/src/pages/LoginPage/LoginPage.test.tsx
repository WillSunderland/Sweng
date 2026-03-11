import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginPage from './LoginPage';


// Mock useNavigate
const mockNavigate = vi.fn();
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
 });


 describe('Rendering', () => {
   it('renders without crashing', () => {
     renderLoginPage();
   });


   it('renders the main heading', () => {
     renderLoginPage();
     expect(screen.getByRole('heading', { level: 1, name: /login page/i })).toBeInTheDocument();
   });


   it('renders the coming soon paragraph', () => {
     renderLoginPage();
     expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
   });


   it('renders the Back to Home button', () => {
     renderLoginPage();
     expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument();
   });
 });


 describe('CSS Classes', () => {
   it('applies login-page class to outer container', () => {
     const { container } = renderLoginPage();
     expect(container.firstChild).toHaveClass('login-page');
   });


   it('applies login-placeholder class to inner container', () => {
     const { container } = renderLoginPage();
     expect(container.querySelector('.login-placeholder')).toBeInTheDocument();
   });


   it('applies btn and btn-primary classes to the button', () => {
     renderLoginPage();
     const button = screen.getByRole('button', { name: /back to home/i });
     expect(button).toHaveClass('btn', 'btn-primary');
   });
 });


 describe('Navigation', () => {
   it('navigates to "/" when Back to Home is clicked', () => {
     renderLoginPage();
     fireEvent.click(screen.getByRole('button', { name: /back to home/i }));
     expect(mockNavigate).toHaveBeenCalledTimes(1);
     expect(mockNavigate).toHaveBeenCalledWith('/');
   });


   it('does not navigate before button is clicked', () => {
     renderLoginPage();
     expect(mockNavigate).not.toHaveBeenCalled();
   });
 });
});
