import React from 'react';
import ReactDOM from 'react-dom/client';
import { Theme } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';
import App from './App';
import './styles/main.css';

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <Theme appearance="dark" accentColor="gray" grayColor="slate" radius="large" panelBackground="translucent">
      <App />
    </Theme>
  </React.StrictMode>
);
