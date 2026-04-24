import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import AddContentModal from './components/AddContentModal';
import Dashboard from './pages/Dashboard';
import CardDetail from './pages/CardDetail';
import GraphView from './pages/GraphView';
import ChatPage from './pages/ChatPage';
import ReviewMode from './pages/ReviewMode';

export default function App() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleAdded = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content" key={refreshKey}>
          <Routes>
            <Route path="/" element={<Dashboard onAddContent={() => setShowAddModal(true)} />} />
            <Route path="/card/:id" element={<CardDetail />} />
            <Route path="/graph" element={<GraphView />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/review" element={<ReviewMode />} />
          </Routes>
        </main>
      </div>

      {showAddModal && (
        <AddContentModal onClose={() => setShowAddModal(false)} onAdded={handleAdded} />
      )}
    </BrowserRouter>
  );
}
