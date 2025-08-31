import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  plugins: [angular()],
  optimizeDeps: {
    exclude: [
      // Core Angular
      '@angular/core',
      '@angular/common',
      '@angular/common/http',
      '@angular/compiler',
      '@angular/animations',
      '@angular/platform-browser',
      '@angular/platform-browser-dynamic',
      '@angular/platform-browser/animations',
      '@angular/router',
      '@angular/forms',
      '@angular/router',
      
      // RxJS
      'rxjs',
      'rxjs/operators',
      'rxjs/internal',
      
      // Autres dépendances problématiques
      'zone.js',
      'tslib',
      
      // UI Libraries
      '@angular/material',
      '@angular/cdk',
      'primeicons',
      'primeng',
      
      // State Management
      '@ngrx/store',
      '@ngrx/effects',
      '@ngrx/entity',
      
      // Internationalization
      '@angular/localize'
    ],
    include: [
      // Dependencies that should be optimized
      '@angular/compiler-cli',
      '@angular/service-worker',
      'date-fns',
      'lodash-es',
      'ngx-markdown',
      'chart.js'
    ]
  },
  build: {
    rollupOptions: {
      external: [
        // Exclude these from bundling if needed
        '@angular/compiler',
        '@angular/compiler-cli'
      ]
    }
  },
  resolve: {
    mainFields: ['module', 'jsnext:main', 'jsnext'],
    alias: {
      // Add any required aliases
    }
  }
});