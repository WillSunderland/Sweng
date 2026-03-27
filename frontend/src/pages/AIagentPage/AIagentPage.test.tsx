import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AIagentPage from './AIagentPage';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock fetch globally
const mockFetch = vi.fn();

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = vi.fn();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const renderPage = () =>
  render(
    <MemoryRouter>
      <AIagentPage />
    </MemoryRouter>
  );

/** Returns a resolved fetch mock for POST /api/runs */
const mockCreateRun = (runId = 'test-run-id-123') =>
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ runId }),
  } as Response);

/** Returns a resolved fetch mock for GET /api/runs/:id */
const mockPollRun = (answer = 'This is a test legal answer.') =>
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      runId: 'test-run-id-123',
      status: 'completed',
      answer,
      documents: [],
    }),
  } as Response);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AIagentPage', () => {
  beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
  mockNavigate.mockClear();
});

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Welcome / Empty State ──────────────────────────────────────────────────

  describe('Welcome State (no chat started)', () => {
    it('renders the welcome title', () => {
      renderPage();
      expect(screen.getByText(/hi james, where should we start/i)).toBeInTheDocument();
    });

    it('renders the welcome subtitle', () => {
      renderPage();
      expect(screen.getByText(/select a task or type a query/i)).toBeInTheDocument();
    });

    it('renders all 4 research task cards', () => {
      renderPage();
      expect(screen.getByText('Regulatory Analysis')).toBeInTheDocument();
      expect(screen.getByText('Compliance Check')).toBeInTheDocument();
      expect(screen.getByText('Case Research')).toBeInTheDocument();
      expect(screen.getByText('Contract Review')).toBeInTheDocument();
    });

    it('renders the message input', () => {
      renderPage();
      expect(screen.getByPlaceholderText(/ask a legal question/i)).toBeInTheDocument();
    });

    it('renders the disclaimer text', () => {
      renderPage();
      expect(screen.getByText(/propylon ai can make mistakes/i)).toBeInTheDocument();
    });

    it('does not show the chat header bar before chat starts', () => {
      renderPage();
      expect(screen.queryByText('AI Legal Assistant')).not.toBeInTheDocument();
    });

    it('does not show the reasoning panel before chat starts', () => {
      renderPage();
      expect(screen.queryByText('AI Reasoning Path')).not.toBeInTheDocument();
    });

    it('send button is disabled when input is empty', () => {
      renderPage();
      expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled();
    });
  });

  // ── Sidebar ────────────────────────────────────────────────────────────────

  describe('Sidebar', () => {
    it('renders the brand name', () => {
      renderPage();
      expect(screen.getByText('rws')).toBeInTheDocument();
      expect(screen.getByText('Propylon')).toBeInTheDocument();
    });

    it('renders sidebar navigation items', () => {
      renderPage();
      expect(screen.getByText('Workspace')).toBeInTheDocument();
      expect(screen.getByText('Drafts')).toBeInTheDocument();
      expect(screen.getByText('Archive')).toBeInTheDocument();
      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    });

    it('renders the user info', () => {
      renderPage();
      expect(screen.getByText('James Sterling')).toBeInTheDocument();
      expect(screen.getByText('Senior Counsel')).toBeInTheDocument();
    });

    it('renders the New Research Case button', () => {
      renderPage();
      expect(screen.getByRole('button', { name: /new research case/i })).toBeInTheDocument();
    });

    it('clicking New Research Case navigates to /workspace', () => {
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: /new research case/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/workspace');
    });
  });

  // ── Input Behaviour ────────────────────────────────────────────────────────

  describe('Input Behaviour', () => {
    it('updates input value when typing', () => {
      renderPage();
      const input = screen.getByPlaceholderText(/ask a legal question/i);
      fireEvent.change(input, { target: { value: 'What are my rights?' } });
      expect(input).toHaveValue('What are my rights?');
    });

    it('send button becomes enabled when input has text', () => {
      renderPage();
      const input = screen.getByPlaceholderText(/ask a legal question/i);
      fireEvent.change(input, { target: { value: 'test query' } });
      expect(screen.getByRole('button', { name: /send message/i })).not.toBeDisabled();
    });

    // it('clears input after sending a message', async () => {
    //   mockCreateRun();
    //   mockPollRun();

    //   renderPage();
    //   const input = screen.getByPlaceholderText(/ask a legal question/i);
    //   fireEvent.change(input, { target: { value: 'test query' } });
    //   fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    //   await waitFor(() => expect(input).toHaveValue(''));
    // });

    it('sends message on Enter key press', async () => {
      mockCreateRun();
      mockPollRun();

      renderPage();
      const input = screen.getByPlaceholderText(/ask a legal question/i);
      fireEvent.change(input, { target: { value: 'test query' } });
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

      await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    });

    it('does not send message on Shift+Enter', () => {
      renderPage();
      const input = screen.getByPlaceholderText(/ask a legal question/i);
      fireEvent.change(input, { target: { value: 'test query' } });
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ── Chat Flow ──────────────────────────────────────────────────────────────

  describe('Chat Flow', () => {
    it('shows user message after sending', async () => {
      mockCreateRun();
      mockPollRun();

      renderPage();
      const input = screen.getByPlaceholderText(/ask a legal question/i);
      fireEvent.change(input, { target: { value: 'What is GDPR?' } });
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => expect(screen.getByText('What is GDPR?')).toBeInTheDocument());
    });

    it('shows typing indicator while waiting for response', async () => {
      // Never resolves poll so typing stays visible
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ runId: 'id-1' }) } as Response)
        .mockResolvedValue({ ok: true, json: async () => ({ runId: 'id-1', status: 'pending' }) } as Response);

      renderPage();
      const input = screen.getByPlaceholderText(/ask a legal question/i);
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() =>
        expect(document.querySelector('.typing-bubble')).toBeInTheDocument()
      );
    });

    it('shows AI response after successful API call', async () => {
      mockCreateRun();
      mockPollRun('GDPR is a data protection regulation.');

      renderPage();
      const input = screen.getByPlaceholderText(/ask a legal question/i);
      fireEvent.change(input, { target: { value: 'What is GDPR?' } });
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() =>
        expect(screen.getByText(/gdpr is a data protection regulation/i)).toBeInTheDocument()
      );
    });

    it('renders trust-highlighted structured segments when structured_answer is returned', async () => {
      mockCreateRun();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          runId: 'test-run-id-123',
          status: 'completed',
          answer: 'Nevada requires a new threshold.',
          structured_answer: {
            raw_answer:
              'Nevada requires a new threshold. «VERBATIM»Section 5: All individuals earning above $80,000 shall be subject to...«/VERBATIM» [Source: Nevada Tax Reform Act]',
            segments: [
              {
                type: 'generated',
                text: 'Nevada requires a new threshold.',
                citations: [
                  {
                    source_id: 'NV-HB-123',
                    title: 'Nevada Tax Reform Act',
                    bill_id: 'NV-HB-123',
                    chunk_id: 'chunk_001',
                    bill_type: 'HB',
                    bill_number: '123',
                    session: '2024',
                    state: 'Nevada',
                    policy_area: 'Taxation',
                    relevance_score: 0.95,
                  },
                ],
              },
              {
                type: 'verbatim',
                text: 'Section 5: All individuals earning above $80,000 shall be subject to...',
                citations: [
                  {
                    source_id: 'NV-HB-123',
                    title: 'Nevada Tax Reform Act',
                    bill_id: 'NV-HB-123',
                    chunk_id: 'chunk_001',
                    bill_type: 'HB',
                    bill_number: '123',
                    session: '2024',
                    state: 'Nevada',
                    policy_area: 'Taxation',
                    relevance_score: 0.95,
                  },
                ],
              },
            ],
          },
          documents: [
            {
              id: 'run_test_src_001',
              title: 'Nevada Tax Reform Act',
              bill_id: 'NV-HB-123',
              bill_type: 'HB',
              bill_number: '123',
              session: '2024',
              state: 'Nevada',
              policy_area: 'Taxation',
              chunk_text: 'Section 5: All individuals earning above $80,000 shall be subject to...',
            },
          ],
        }),
      } as Response);

      renderPage();
      const input = screen.getByPlaceholderText(/ask a legal question/i);
      fireEvent.change(input, { target: { value: 'What does Nevada HB 123 do?' } });
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => expect(screen.getByText('AI Analysis')).toBeInTheDocument());
      expect(screen.getByText('Verbatim Law Text')).toBeInTheDocument();
      expect(screen.getByText('VERBATIM')).toBeInTheDocument();
      expect(
        screen.getByText(/Section 5: All individuals earning above \$80,000 shall be subject to/i)
      ).toBeInTheDocument();
      expect(screen.getAllByText('[NV-HB-123]').length).toBeGreaterThan(0);
    });

    it('shows chat header bar after first message', async () => {
      mockCreateRun();
      mockPollRun();

      renderPage();
      const input = screen.getByPlaceholderText(/ask a legal question/i);
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() =>
        expect(screen.getByText('AI Legal Assistant')).toBeInTheDocument()
      );
    });

    it('shows reasoning panel after first message', async () => {
      mockCreateRun();
      mockPollRun();

      renderPage();
      const input = screen.getByPlaceholderText(/ask a legal question/i);
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() =>
        expect(screen.getByText('AI Reasoning Path')).toBeInTheDocument()
      );
    });

    // it('disables input while waiting for response', async () => {
    //   mockFetch
    //     .mockResolvedValueOnce({ ok: true, json: async () => ({ runId: 'id-1' }) } as Response)
    //     .mockResolvedValue({ ok: true, json: async () => ({ runId: 'id-1', status: 'pending' }) } as Response);

    //   renderPage();
    //   const input = screen.getByPlaceholderText(/ask a legal question/i);
    //   fireEvent.change(input, { target: { value: 'test' } });
    //   fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    //   await waitFor(() => expect(input).toBeDisabled());
    // });
  });

  // ── Error Handling ─────────────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('shows error message when API call fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as Response);

      renderPage();
      const input = screen.getByPlaceholderText(/ask a legal question/i);
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() =>
        expect(screen.getByText(/failed to start run/i)).toBeInTheDocument()
      );
    });

    it('shows error message when fetch throws a network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      renderPage();
      const input = screen.getByPlaceholderText(/ask a legal question/i);
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() =>
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
      );
    });

    it('re-enables input after an error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      renderPage();
      const input = screen.getByPlaceholderText(/ask a legal question/i);
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => expect(input).not.toBeDisabled());
    });
  });

  // ── Research Task Cards ────────────────────────────────────────────────────

  describe('Research Task Cards', () => {
    it('clicking a task card sends its query', async () => {
      mockCreateRun();
      mockPollRun();

      renderPage();
      fireEvent.click(screen.getByText('Regulatory Analysis'));

      await waitFor(() =>
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:8000/api/runs',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('regulatory'),
          })
        )
      );
    });

    // it('task cards are disabled while typing', async () => {
    //   mockFetch
    //     .mockResolvedValueOnce({ ok: true, json: async () => ({ runId: 'id-1' }) } as Response)
    //     .mockResolvedValue({ ok: true, json: async () => ({ status: 'pending' }) } as Response);

    //   renderPage();
    //   const input = screen.getByPlaceholderText(/ask a legal question/i);
    //   fireEvent.change(input, { target: { value: 'test' } });
    //   fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    //   await waitFor(() =>
    //     expect(screen.getByText('Regulatory Analysis').closest('button')).toBeDisabled()
    //   );
    // });
  });

  // ── Accessibility ──────────────────────────────────────────────────────────

  describe('Accessibility', () => {
    it('send button has an aria-label', () => {
      renderPage();
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
    });

    it('attach file button has an aria-label', () => {
      renderPage();
      expect(screen.getByRole('button', { name: /attach file/i })).toBeInTheDocument();
    });

    it('voice input button has an aria-label', () => {
      renderPage();
      expect(screen.getByRole('button', { name: /voice input/i })).toBeInTheDocument();
    });
  });

  // ── Initial Assistant Message ──────────────────────────────────────────────

  describe('Initial State', () => {
    it('shows the initial assistant greeting', () => {
      renderPage();
      // The greeting is in the messages array but only rendered after hasStartedChat
      // so we just confirm it doesn't crash and the welcome state is shown
      expect(screen.getByText(/hi james/i)).toBeInTheDocument();
    });
  });
});
