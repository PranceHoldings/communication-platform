'use client';

import Link from 'next/link';

interface Action {
  name: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  color: string;
}

interface QuickActionsProps {
  actions: Action[];
}

export default function QuickActions({ actions }: QuickActionsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {actions.map((action) => (
        <Link
          key={action.name}
          href={action.href}
          className="relative group bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
        >
          <div className="p-6">
            <div
              className={`inline-flex p-3 rounded-lg ${action.color} bg-opacity-10 group-hover:bg-opacity-20 transition-colors`}
            >
              {action.icon}
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
              {action.name}
            </h3>
            <p className="mt-2 text-sm text-gray-500">{action.description}</p>
          </div>
          <div className="absolute bottom-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <svg
              className="h-6 w-6 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      ))}
    </div>
  );
}
