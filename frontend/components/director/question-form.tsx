'use client';

/**
 * Question Form Component
 * Slice 8: Frontend Chat UI
 */

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { ClarifyingQuestion } from '@/lib/agents/types';

interface QuestionFormProps {
  questions: ClarifyingQuestion[];
  onSubmit: (answers: Record<string, unknown>) => void;
  disabled?: boolean;
}

export function QuestionForm({ questions, onSubmit, disabled }: QuestionFormProps) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if all required questions are answered
    const missingRequired = questions.filter(
      q => q.required && !answers[q.field]
    );

    if (missingRequired.length > 0) {
      alert('Please answer all required questions');
      return;
    }

    onSubmit(answers);
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <CheckCircle2 className="w-5 h-5 text-blue-600" />
        <h3 className="font-medium">Please answer these questions:</h3>
      </div>

      {questions.map((question, index) => (
        <div key={question.id} className="space-y-2">
          <label className="block text-sm font-medium text-gray-900">
            {index + 1}. {question.question}
            {question.required && <span className="text-red-500 ml-1">*</span>}
          </label>

          {question.options ? (
            // Radio buttons for options
            <div className="space-y-2">
              {question.options.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="radio"
                    name={question.field}
                    checked={answers[question.field] === option}
                    onChange={() => handleAnswerChange(question.field, option, false)}
                    disabled={disabled}
                    className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          ) : (
            // Text input
            <textarea
              value={(answers[question.field] as string) || ''}
              onChange={(e) => setAnswers(prev => ({ ...prev, [question.field]: e.target.value }))}
              disabled={disabled}
              placeholder="Type your answer..."
              rows={3}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed bg-white text-slate-900 placeholder:text-slate-400"
            />
          )}
        </div>
      ))}

      <button
        type="submit"
        disabled={disabled}
        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
      >
        Submit Answers
      </button>
    </form>
  );
}

