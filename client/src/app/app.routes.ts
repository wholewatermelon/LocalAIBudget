import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Dashboard · LocalAI Budget',
    loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
  {
    path: 'process',
    title: 'Process · LocalAI Budget',
    loadComponent: () => import('./features/process/process.page').then((m) => m.ProcessPage),
  },
  {
    path: 'transactions',
    title: 'Transactions · LocalAI Budget',
    loadComponent: () =>
      import('./features/transactions/transactions.page').then((m) => m.TransactionsPage),
  },
  {
    path: 'categories',
    title: 'Categories · LocalAI Budget',
    loadComponent: () =>
      import('./features/categories/categories.page').then((m) => m.CategoriesPage),
  },
  {
    path: 'rules',
    title: 'Rules · LocalAI Budget',
    loadComponent: () => import('./features/rules/rules.page').then((m) => m.RulesPage),
  },
  { path: '**', redirectTo: '' },
];
