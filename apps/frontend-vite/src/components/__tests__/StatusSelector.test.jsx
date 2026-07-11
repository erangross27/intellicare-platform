/**
 * Comprehensive tests for StatusSelector component
 * Tests status selection, visual indicators, and StatusDisplay component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StatusSelector, { StatusDisplay } from '../StatusSelector';

// Mock the useLanguage hook
const mockUseLanguage = {
  t: (key) => {
    const translations = {
      'active': 'Active',
      'inactive': 'Inactive',
      'archived': 'Archived',
      'patientStatus': 'Patient Status',
      'notProvided': 'Not Provided'
    };
    return translations[key] || key;
  },
  isRTL: false
};

jest.mock('../../config/languagesStatic', () => ({
  useLanguage: () => mockUseLanguage
}));

describe('StatusSelector Component', () => {
  const defaultProps = {
    value: 'active',
    onChange: jest.fn(),
    disabled: false,
    showIndicator: true,
    size: 'medium'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders status selector with default value', () => {
      render(<StatusSelector {...defaultProps} />);
      
      expect(screen.getByLabelText(/patient status/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('Active')).toBeInTheDocument();
    });

    test('renders all status options', () => {
      render(<StatusSelector {...defaultProps} />);
      
      const select = screen.getByLabelText(/patient status/i);
      expect(select).toBeInTheDocument();
      
      // Check if all options are present
      expect(screen.getByRole('option', { name: 'Active' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Inactive' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Archived' })).toBeInTheDocument();
    });

    test('shows status indicator when showIndicator=true', () => {
      render(<StatusSelector {...defaultProps} showIndicator={true} />);
      
      const indicator = screen.getByText('✓'); // Active status icon
      expect(indicator).toBeInTheDocument();
    });

    test('hides status indicator when showIndicator=false', () => {
      render(<StatusSelector {...defaultProps} showIndicator={false} />);
      
      const indicator = screen.queryByText('✓');
      expect(indicator).not.toBeInTheDocument();
    });

    test('applies correct size styling', () => {
      const { rerender } = render(<StatusSelector {...defaultProps} size="small" />);
      
      let select = screen.getByLabelText(/patient status/i);
      expect(select).toHaveStyle({ fontSize: '0.875rem' });
      
      rerender(<StatusSelector {...defaultProps} size="large" />);
      select = screen.getByLabelText(/patient status/i);
      expect(select).toHaveStyle({ fontSize: '1.125rem' });
    });
  });

  describe('User Interactions', () => {
    test('calls onChange when status changes', async () => {
      const onChange = jest.fn();
      render(<StatusSelector {...defaultProps} onChange={onChange} />);
      
      const select = screen.getByLabelText(/patient status/i);
      fireEvent.change(select, { target: { value: 'inactive' } });
      
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith('inactive');
      });
    });

    test('does not call onChange when disabled', () => {
      const onChange = jest.fn();
      render(<StatusSelector {...defaultProps} onChange={onChange} disabled={true} />);
      
      const select = screen.getByLabelText(/patient status/i);
      expect(select).toBeDisabled();
      
      fireEvent.change(select, { target: { value: 'inactive' } });
      expect(onChange).not.toHaveBeenCalled();
    });

    test('updates indicator when status changes', async () => {
      const { rerender } = render(<StatusSelector {...defaultProps} value="active" />);
      
      expect(screen.getByText('✓')).toBeInTheDocument(); // Active icon
      
      rerender(<StatusSelector {...defaultProps} value="inactive" />);
      expect(screen.getByText('⏸')).toBeInTheDocument(); // Inactive icon
      
      rerender(<StatusSelector {...defaultProps} value="archived" />);
      expect(screen.getByText('📦')).toBeInTheDocument(); // Archived icon
    });
  });

  describe('Status Colors and Styling', () => {
    test('applies correct colors for active status', () => {
      render(<StatusSelector {...defaultProps} value="active" />);
      
      const indicator = screen.getByText('Active').closest('.status-indicator');
      expect(indicator).toHaveStyle({
        backgroundColor: '#d1fae5',
        color: '#10b981'
      });
    });

    test('applies correct colors for inactive status', () => {
      render(<StatusSelector {...defaultProps} value="inactive" />);
      
      const indicator = screen.getByText('Inactive').closest('.status-indicator');
      expect(indicator).toHaveStyle({
        backgroundColor: '#fee2e2',
        color: '#ef4444'
      });
    });

    test('applies correct colors for archived status', () => {
      render(<StatusSelector {...defaultProps} value="archived" />);
      
      const indicator = screen.getByText('Archived').closest('.status-indicator');
      expect(indicator).toHaveStyle({
        backgroundColor: '#f3f4f6',
        color: '#6b7280'
      });
    });
  });

  describe('RTL Support', () => {
    test('applies RTL styles when isRTL=true', () => {
      mockUseLanguage.isRTL = true;
      
      render(<StatusSelector {...defaultProps} />);
      
      const container = screen.getByLabelText(/patient status/i).closest('.status-selector');
      expect(container).toHaveStyle({ direction: 'rtl' });
      
      // Reset for other tests
      mockUseLanguage.isRTL = false;
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels', () => {
      render(<StatusSelector {...defaultProps} />);
      
      const select = screen.getByLabelText(/patient status/i);
      expect(select).toHaveAttribute('id', 'status');
      expect(select).toHaveAttribute('name', 'status');
      expect(select).toHaveAttribute('required');
    });

    test('supports keyboard navigation', () => {
      render(<StatusSelector {...defaultProps} />);
      
      const select = screen.getByLabelText(/patient status/i);
      select.focus();
      expect(select).toHaveFocus();
    });
  });
});

describe('StatusDisplay Component', () => {
  const defaultProps = {
    status: 'active',
    size: 'medium',
    showIcon: true
  };

  describe('Rendering', () => {
    test('renders status display with correct text', () => {
      render(<StatusDisplay {...defaultProps} />);
      
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    test('renders different statuses correctly', () => {
      const { rerender } = render(<StatusDisplay {...defaultProps} status="inactive" />);
      
      expect(screen.getByText('Inactive')).toBeInTheDocument();
      expect(screen.getByText('⏸')).toBeInTheDocument();
      
      rerender(<StatusDisplay {...defaultProps} status="archived" />);
      expect(screen.getByText('Archived')).toBeInTheDocument();
      expect(screen.getByText('📦')).toBeInTheDocument();
    });

    test('hides icon when showIcon=false', () => {
      render(<StatusDisplay {...defaultProps} showIcon={false} />);
      
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.queryByText('✓')).not.toBeInTheDocument();
    });

    test('applies correct size styling', () => {
      const { rerender } = render(<StatusDisplay {...defaultProps} size="small" />);
      
      let display = screen.getByText('Active').closest('.status-display');
      expect(display).toHaveStyle({ fontSize: '0.75rem' });
      
      rerender(<StatusDisplay {...defaultProps} size="large" />);
      display = screen.getByText('Active').closest('.status-display');
      expect(display).toHaveStyle({ fontSize: '1rem' });
    });

    test('handles undefined status gracefully', () => {
      render(<StatusDisplay status={undefined} />);
      
      // Should render active as default
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  describe('Status Colors', () => {
    test('applies correct colors for each status', () => {
      const { rerender } = render(<StatusDisplay {...defaultProps} status="active" />);
      
      let display = screen.getByText('Active').closest('.status-display');
      expect(display).toHaveStyle({
        backgroundColor: '#d1fae5',
        color: '#10b981'
      });
      
      rerender(<StatusDisplay {...defaultProps} status="inactive" />);
      display = screen.getByText('Inactive').closest('.status-display');
      expect(display).toHaveStyle({
        backgroundColor: '#fee2e2',
        color: '#ef4444'
      });
      
      rerender(<StatusDisplay {...defaultProps} status="archived" />);
      display = screen.getByText('Archived').closest('.status-display');
      expect(display).toHaveStyle({
        backgroundColor: '#f3f4f6',
        color: '#6b7280'
      });
    });
  });
});
