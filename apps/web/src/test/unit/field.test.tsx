import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field, Input } from '@/components/ui/Field';

describe('Field', () => {
  it('associates the label, hint and error with the control', () => {
    render(
      <Field label="Email" hint="We never share it." error="Enter a valid email">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a valid email');
  });

  it('shows the hint when there is no error', () => {
    render(
      <Field label="Name" hint="Shown on your profile.">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('Name');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).toHaveAccessibleDescription('Shown on your profile.');
  });
});
