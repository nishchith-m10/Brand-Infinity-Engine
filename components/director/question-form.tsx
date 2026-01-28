'use client';

/**
 * Question Form Component
 * Slice 8: Frontend Chat UI
 */

import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import type { ClarifyingQuestion } from '@/lib/agents/types';

interface QuestionFormProps {
  questions: ClarifyingQuestion[];
  onSubmit: (answers: Record<string, unknown>) => void;
  disabled?: boolean;
}

export function QuestionForm({ questions, onSubmit, disabled }: QuestionFormProps) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if all required questions are answered
    const missingRequired = questions.filter(
      q => q.required && !answers[q.field]
    );

    if (missingRequired.length > 0) {
      alert('Please answer all required questions');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(answers);
    } catch (error) {
      console.error('Question form submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAnswerChange = (field: string, value: unknown, multiple: boolean) => {
    if (multiple) {
      // For multiple selection
      const current = (answers[field] as unknown[]) || [];
      const updated = current.includes(value)
        ? current.filter((v: unknown) => v !== value)
        : [...current, value];
      setAnswers(prev => ({ ...prev, [field]: updated }));
    } else {
      setAnswers(prev => ({ ...prev, [field]: value }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" role="form" aria-label="Clarifying questions form">
      <header className="flex items-center gap-2 mb-4">
        <CheckCircle2 className="w-5 h-5 text-blue-600" aria-hidden="true" />
        <h3 className="font-medium" id="questions-heading">Please answer these questions:</h3>
      </header>

      <div role="group" aria-labelledby="questions-heading">

      {questions.map((question, index) => (
        <div key={question.id} className="space-y-2">
          <label htmlFor={question.options ? undefined : `question-${question.id}`} className="block text-sm font-medium text-gray-900">
            {index + 1}. {question.question}
            {question.required && (
              <>
                <span className="text-red-500 ml-1" aria-label="required">*</span>
                <span id={`question-${question.id}-required`} className="sr-only">
                  This field is required
                </span>
              </>
            )}
          </label>

          {question.options ? (
            // Radio buttons for options
            <fieldset className="space-y-2">
              <legend className="sr-only">{question.question}</legend>
              {question.options.map((option, optionIndex) => (
                <label
                  key={option}
                  className="flex items-center gap-2 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer focus-within:ring-2 focus-within:ring-primary"
                >
                  <input
                    type="radio"
                    name={question.field}
                    id={`question-${question.id}-option-${optionIndex}`}
                    checked={answers[question.field] === option}
                    onChange={() => handleAnswerChange(question.field, option, false)}
                    disabled={disabled}
                    className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{option}</span>
                </label>
              ))}
            </fieldset>
          ) : (
            // Text input
            <textarea
              id={`question-${question.id}`}
              value={(answers[question.field] as string) || ''}
              onChange={(e) => setAnswers(prev => ({ ...prev, [question.field]: e.target.value }))}
              disabled={disabled}
              placeholder="Type your answer..."
              rows={3}
              aria-required={question.required}
              aria-describedby={question.required ? `question-${question.id}-required` : undefined}
              className="w-full px-4 py-3 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-muted disabled:cursor-not-allowed bg-background text-foreground placeholder:text-muted-foreground"
            />
          )}
        </div>
      ))}
      </div>

      <button
        type="submit"
        disabled={disabled || isSubmitting}
        aria-describedby={isSubmitting ? 'submit-status' : undefined}
        className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        <span id={isSubmitting ? 'submit-status' : undefined}>
          {isSubmitting ? 'Submitting...' : 'Submit Answers'}
        </span>
      </button>
    </form>
  );
}

