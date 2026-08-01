import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { PresenceProvider } from './context/PresenceContext.jsx';
import Login from './components/Login.jsx';
import Signup from './components/Signup.jsx';
import ConversationList from './components/ConversationList.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import UserMenu from './components/UserMenu.jsx';
import './index.css';

function AppContent() {
  const { user, loading } = useAuth();
  const [showSignup, setShowSignup] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeConversationLabel, setActiveConversationLabel] = useState('');
  const [activeOtherUserId, setActiveOtherUserId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  if (loading) return <p className="loading-screen">Loading...</p>;

  if (!user) {
    return showSignup ? (
      <Signup onSwitchToLogin={() => setShowSignup(false)} />
    ) : (
      <Login onSwitchToSignup={() => setShowSignup(true)} />
    );
  }

  function handleSelectConversation(id, label, otherUserId) {
    setActiveConversationId(id);
    if (label) setActiveConversationLabel(label);
    setActiveOtherUserId(otherUserId ?? null);
  }

  function handleConversationsChanged() {
    // triggers ConversationList to refetch (new accept, live accept, delete, etc.)
    setRefreshTrigger((prev) => prev + 1);
  }

  // On narrow (phone) viewports we only show one pane at a time — the
  // conversation list, or the open chat. `chat-open` toggles which one via
  // CSS; on wider viewports both panes stay visible regardless of this class.
  const layoutClassName = activeConversationId ? 'app-layout chat-open' : 'app-layout';

  return (
    <div className={layoutClassName}>
      <div className="sidebar">
        <UserMenu
          onConversationCreated={handleSelectConversation}
          onConversationsChanged={handleConversationsChanged}
        />
        <ConversationList
          onSelectConversation={handleSelectConversation}
          activeConversationId={activeConversationId}
          refreshTrigger={refreshTrigger}
        />
      </div>
      <ChatWindow
        conversationId={activeConversationId}
        conversationLabel={activeConversationLabel}
        otherUserId={activeOtherUserId}
        onBack={() => setActiveConversationId(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PresenceProvider>
        <AppContent />
      </PresenceProvider>
    </AuthProvider>
  );
}