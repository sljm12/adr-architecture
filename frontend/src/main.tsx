import React from 'react'; import {createRoot} from 'react-dom/client'; import {DiagramWorkspace} from './components/DiagramWorkspace'; import './styles.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><DiagramWorkspace/></React.StrictMode>);
