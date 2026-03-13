'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface Question {
  id: string;
  text: string;
  type: 'open' | 'follow_up' | 'clarification';
  order: number;
  required?: boolean;
  expectedDuration?: number; // seconds
  hints?: string[];
  evaluationCriteria?: string[];
}

interface QuestionEditorProps {
  questions: Question[];
  onChange: (questions: Question[]) => void;
  disabled?: boolean;
}

interface SortableQuestionItemProps {
  question: Question;
  index: number;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}

function SortableQuestionItem({
  question,
  index,
  onEdit,
  onDelete,
  disabled,
}: SortableQuestionItemProps) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const typeLabels: Record<Question['type'], string> = {
    open: t('scenarios.questions.types.open'),
    follow_up: t('scenarios.questions.types.followUp'),
    clarification: t('scenarios.questions.types.clarification'),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm ${
        isDragging ? 'shadow-lg' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          disabled={disabled}
          className={`mt-1 ${
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-grab active:cursor-grabbing'
          }`}
          aria-label={t('scenarios.questions.dragToReorder')}
        >
          <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
          </svg>
        </button>

        {/* Question Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
              #{index + 1}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
              {typeLabels[question.type]}
            </span>
            {question.required && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                {t('scenarios.questions.required')}
              </span>
            )}
            {question.expectedDuration && (
              <span className="text-xs text-gray-500">
                ~{question.expectedDuration}s
              </span>
            )}
          </div>
          <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
            {question.text}
          </p>
          {question.hints && question.hints.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-gray-700 mb-1">
                {t('scenarios.questions.hints')}:
              </p>
              <ul className="text-xs text-gray-600 list-disc list-inside space-y-0.5">
                {question.hints.map((hint, i) => (
                  <li key={i}>{hint}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(question.id)}
            disabled={disabled}
            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={t('common.edit')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
          <button
            onClick={() => onDelete(question.id)}
            disabled={disabled}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={t('common.delete')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

interface QuestionFormProps {
  question?: Question;
  onSave: (question: Omit<Question, 'id' | 'order'>) => void;
  onCancel: () => void;
}

function QuestionForm({ question, onSave, onCancel }: QuestionFormProps) {
  const { t } = useI18n();
  const [text, setText] = useState(question?.text || '');
  const [type, setType] = useState<Question['type']>(question?.type || 'open');
  const [required, setRequired] = useState(question?.required || false);
  const [expectedDuration, setExpectedDuration] = useState<string>(
    question?.expectedDuration?.toString() || ''
  );
  const [hints, setHints] = useState<string>(question?.hints?.join('\n') || '');
  const [evaluationCriteria, setEvaluationCriteria] = useState<string>(
    question?.evaluationCriteria?.join('\n') || ''
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    onSave({
      text: text.trim(),
      type,
      required,
      expectedDuration: expectedDuration ? parseInt(expectedDuration) : undefined,
      hints: hints
        .split('\n')
        .map(h => h.trim())
        .filter(h => h),
      evaluationCriteria: evaluationCriteria
        .split('\n')
        .map(c => c.trim())
        .filter(c => c),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
      <div>
        <label htmlFor="questionText" className="block text-sm font-medium text-gray-700 mb-1">
          {t('scenarios.questions.form.text')} <span className="text-red-500">*</span>
        </label>
        <textarea
          id="questionText"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={t('scenarios.questions.form.textPlaceholder')}
          rows={3}
          required
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="questionType" className="block text-sm font-medium text-gray-700 mb-1">
            {t('scenarios.questions.form.type')}
          </label>
          <select
            id="questionType"
            value={type}
            onChange={e => setType(e.target.value as Question['type'])}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="open">{t('scenarios.questions.types.open')}</option>
            <option value="follow_up">{t('scenarios.questions.types.followUp')}</option>
            <option value="clarification">{t('scenarios.questions.types.clarification')}</option>
          </select>
        </div>

        <div>
          <label htmlFor="expectedDuration" className="block text-sm font-medium text-gray-700 mb-1">
            {t('scenarios.questions.form.expectedDuration')}
          </label>
          <input
            id="expectedDuration"
            type="number"
            min="0"
            value={expectedDuration}
            onChange={e => setExpectedDuration(e.target.value)}
            placeholder="30"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-end">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={required}
              onChange={e => setRequired(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-2 text-sm text-gray-700">
              {t('scenarios.questions.form.required')}
            </span>
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="hints" className="block text-sm font-medium text-gray-700 mb-1">
          {t('scenarios.questions.form.hints')}
        </label>
        <textarea
          id="hints"
          value={hints}
          onChange={e => setHints(e.target.value)}
          placeholder={t('scenarios.questions.form.hintsPlaceholder')}
          rows={2}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          {t('scenarios.questions.form.hintsHelp')}
        </p>
      </div>

      <div>
        <label htmlFor="evaluationCriteria" className="block text-sm font-medium text-gray-700 mb-1">
          {t('scenarios.questions.form.evaluationCriteria')}
        </label>
        <textarea
          id="evaluationCriteria"
          value={evaluationCriteria}
          onChange={e => setEvaluationCriteria(e.target.value)}
          placeholder={t('scenarios.questions.form.evaluationCriteriaPlaceholder')}
          rows={2}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          {t('scenarios.questions.form.evaluationCriteriaHelp')}
        </p>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          {question ? t('common.save') : t('scenarios.questions.addQuestion')}
        </button>
      </div>
    </form>
  );
}

export function QuestionEditor({ questions, onChange, disabled = false }: QuestionEditorProps) {
  const { t } = useI18n();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = questions.findIndex(q => q.id === active.id);
      const newIndex = questions.findIndex(q => q.id === over.id);

      const reordered = arrayMove(questions, oldIndex, newIndex).map((q, index) => ({
        ...q,
        order: index,
      }));

      onChange(reordered);
    }
  };

  const handleAdd = (questionData: Omit<Question, 'id' | 'order'>) => {
    const newQuestion: Question = {
      ...questionData,
      id: `question-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      order: questions.length,
    };
    onChange([...questions, newQuestion]);
    setIsAdding(false);
  };

  const handleEdit = (id: string, questionData: Omit<Question, 'id' | 'order'>) => {
    onChange(
      questions.map(q =>
        q.id === id
          ? {
              ...q,
              ...questionData,
            }
          : q
      )
    );
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (confirm(t('scenarios.questions.confirmDelete'))) {
      onChange(questions.filter(q => q.id !== id).map((q, index) => ({ ...q, order: index })));
    }
  };

  const editingQuestion = editingId ? questions.find(q => q.id === editingId) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            {t('scenarios.questions.title')}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {t('scenarios.questions.description')}
          </p>
        </div>
        {!isAdding && !editingId && (
          <button
            onClick={() => setIsAdding(true)}
            disabled={disabled}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            {t('scenarios.questions.addQuestion')}
          </button>
        )}
      </div>

      {/* Add Form */}
      {isAdding && (
        <QuestionForm onSave={handleAdd} onCancel={() => setIsAdding(false)} />
      )}

      {/* Edit Form */}
      {editingId && editingQuestion && (
        <QuestionForm
          question={editingQuestion}
          onSave={data => handleEdit(editingId, data)}
          onCancel={() => setEditingId(null)}
        />
      )}

      {/* Questions List */}
      {questions.length === 0 && !isAdding && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {t('scenarios.questions.empty')}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {t('scenarios.questions.emptyDescription')}
          </p>
        </div>
      )}

      {questions.length > 0 && !editingId && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {questions.map((question, index) => (
                <SortableQuestionItem
                  key={question.id}
                  question={question}
                  index={index}
                  onEdit={setEditingId}
                  onDelete={handleDelete}
                  disabled={disabled}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {questions.length > 0 && !isAdding && !editingId && (
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          {t('scenarios.questions.dragInfo')}
        </div>
      )}
    </div>
  );
}
