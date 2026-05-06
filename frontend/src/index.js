import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const params = new URLSearchParams(window.location.search);
if (params.has('connected')) {
  sessionStorage.setItem('plannerCalendarToast', JSON.stringify({
    type: 'success',
    message: `Connected ${params.get('connected')} calendar.`,
  }));
}
if (params.has('calendar_error')) {
  sessionStorage.setItem('plannerCalendarToast', JSON.stringify({
    type: 'error',
    message: decodeURIComponent(params.get('calendar_error')),
  }));
}
if (params.has('connected') || params.has('calendar_error')) {
  window.history.replaceState({}, '', window.location.pathname);
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
