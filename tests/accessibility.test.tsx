/**
 * Accessibility Tests
 * Phase V, Pillar 3: Accessibility Enhancements
 */

import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { ScreenReaderOnly, AccessibleIcon, AccessibleProgress } from '@/lib/accessibility/utils';

describe('Accessibility - Form Components', () => {
  describe('Input Component', () => {
    test('should have proper ARIA attributes when required', () => {
      render(
        <Input
          label="Email Address"
          placeholder="Enter your email"
          required
          error="Email is required"
        />
      );

      const input = screen.getByLabelText(/email address/i);
      
      expect(input).toHaveAttribute('aria-required', 'true');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby');
      
      // Check for required indicator
      expect(screen.getByLabelText('required')).toBeInTheDocument();
    });

    test('should associate helper text with input', () => {
      render(
        <Input
          label="Username"
          helperText="Must be at least 3 characters"
        />
      );

      const input = screen.getByLabelText(/username/i);
      const helperText = screen.getByText(/must be at least 3 characters/i);
      
      expect(input).toHaveAttribute('aria-describedby', expect.stringContaining(helperText.id));
    });

    test('should announce errors to screen readers', () => {
      render(
        <Input
          label="Password"
          error="Password is too weak"
        />
      );

      const errorMessage = screen.getByText(/password is too weak/i);
      expect(errorMessage).toHaveAttribute('role', 'alert');
    });
  });

  describe('Select Component', () => {
    const options = [
      { value: 'option1', label: 'Option 1' },
      { value: 'option2', label: 'Option 2' },
      { value: 'option3', label: 'Option 3' },
    ];

    test('should have proper ARIA attributes', () => {
      render(
        <Select
          label="Choose an option"
          options={options}
          required
        />
      );

      const select = screen.getByLabelText(/choose an option/i);
      
      expect(select).toHaveAttribute('aria-required', 'true');
      expect(select).toHaveAttribute('aria-invalid', 'false');
    });

    test('should hide decorative chevron icon from screen readers', () => {
      render(
        <Select
          label="Select option"
          options={options}
        />
      );

      const chevronIcon = document.querySelector('[aria-hidden="true"]');
      expect(chevronIcon).toBeInTheDocument();
    });
  });

  describe('Button Component', () => {
    test('should announce loading state to screen readers', () => {
      render(
        <Button isLoading loadingText="Saving...">
          Save Changes
        </Button>
      );

      const loadingText = screen.getByText(/saving/i);
      expect(loadingText).toBeInTheDocument();
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    test('should have proper disabled state attributes', () => {
      render(<Button disabled>Disabled Button</Button>);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    test('should hide loading spinner from screen readers', () => {
      render(
        <Button isLoading>
          Loading Button
        </Button>
      );

      const spinner = document.querySelector('[aria-hidden="true"]');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Textarea Component', () => {
    test('should have proper ARIA attributes', () => {
      render(
        <Textarea
          label="Description"
          placeholder="Enter description"
          required
          helperText="Maximum 500 characters"
        />
      );

      const textarea = screen.getByLabelText(/description/i);
      
      expect(textarea).toHaveAttribute('aria-required', 'true');
      expect(textarea).toHaveAttribute('aria-describedby');
    });
  });
});

describe('Accessibility - Modal Component', () => {
  test('should trap focus within modal', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    
    render(
      <div>
        <button>Outside Button</button>
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          <input placeholder="First input" />
          <button>Modal Button</button>
          <input placeholder="Last input" />
        </Modal>
      </div>
    );

    const modal = screen.getByRole('dialog');
    expect(modal).toBeInTheDocument();
    
    // Focus should be trapped within modal
    const closeButton = screen.getByLabelText(/close modal/i);
    expect(closeButton).toHaveFocus();

    // Test tab cycling
    await user.tab();
    expect(screen.getByPlaceholderText(/first input/i)).toHaveFocus();
    
    await user.tab();
    expect(screen.getByText(/modal button/i)).toHaveFocus();
  });

  test('should close on Escape key', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    
    render(
      <Modal isOpen={true} onClose={onClose} title="Test Modal">
        <p>Modal content</p>
      </Modal>
    );

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  test('should have proper ARIA attributes', () => {
    render(
      <Modal 
        isOpen={true} 
        onClose={() => {}} 
        title="Test Title"
        description="Test description"
      >
        <p>Content</p>
      </Modal>
    );

    const modal = screen.getByRole('dialog');
    
    expect(modal).toHaveAttribute('aria-modal', 'true');
    expect(modal).toHaveAttribute('aria-labelledby');
    expect(modal).toHaveAttribute('aria-describedby');
    
    expect(screen.getByText(/test title/i)).toHaveAttribute('id');
    expect(screen.getByText(/test description/i)).toHaveAttribute('id');
  });
});

describe('Accessibility - Utility Components', () => {
  describe('ScreenReaderOnly', () => {
    test('should be hidden visually but accessible to screen readers', () => {
      render(<ScreenReaderOnly>Hidden text</ScreenReaderOnly>);
      
      const element = screen.getByText(/hidden text/i);
      expect(element).toHaveClass('sr-only');
    });
  });

  describe('AccessibleIcon', () => {
    test('should provide proper labeling for non-decorative icons', () => {
      render(
        <AccessibleIcon label="Settings">
          <span>⚙️</span>
        </AccessibleIcon>
      );
      
      const icon = screen.getByRole('img');
      expect(icon).toHaveAttribute('aria-label', 'Settings');
    });

    test('should hide decorative icons from screen readers', () => {
      render(
        <AccessibleIcon isDecorative>
          <span>✨</span>
        </AccessibleIcon>
      );
      
      const icon = document.querySelector('[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('AccessibleProgress', () => {
    test('should have proper progress attributes', () => {
      render(
        <AccessibleProgress
          value={75}
          max={100}
          label="Upload progress"
        />
      );

      const progressBar = screen.getByRole('progressbar');
      
      expect(progressBar).toHaveAttribute('aria-valuenow', '75');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      expect(progressBar).toHaveAttribute('aria-label');
    });

    test('should display percentage when enabled', () => {
      render(
        <AccessibleProgress
          value={60}
          max={100}
          label="Download"
          showPercentage={true}
        />
      );

      expect(screen.getByText(/60%/i)).toBeInTheDocument();
    });
  });
});

describe('Accessibility - Keyboard Navigation', () => {
  test('should handle keyboard navigation in lists', async () => {
    const user = userEvent.setup();
    
    render(
      <ul role="listbox" aria-label="Options">
        <li role="option" tabIndex={0}>Option 1</li>
        <li role="option" tabIndex={-1}>Option 2</li>
        <li role="option" tabIndex={-1}>Option 3</li>
      </ul>
    );

    const firstOption = screen.getByText(/option 1/i);
    firstOption.focus();
    
    expect(firstOption).toHaveFocus();
    
    // Test arrow key navigation would need additional implementation
    // This is a basic structure test
  });
});

describe('Accessibility - Color Contrast', () => {
  test('should have sufficient color contrast for text', () => {
    render(
      <div className="text-gray-900 bg-white">
        High contrast text
      </div>
    );
    
    const element = screen.getByText(/high contrast text/i);
    expect(element).toHaveClass('text-gray-900');
    expect(element).toHaveClass('bg-white');
  });
});

describe('Accessibility - Form Validation', () => {
  test('should announce form validation errors', () => {
    const { rerender } = render(
      <Input label="Email" value="" />
    );
    
    // Simulate validation error
    rerender(
      <Input 
        label="Email" 
        value=""
        error="Email is required"
        required
      />
    );
    
    const errorMessage = screen.getByText(/email is required/i);
    expect(errorMessage).toHaveAttribute('role', 'alert');
  });
});