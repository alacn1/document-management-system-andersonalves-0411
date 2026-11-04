import { useState } from 'react';
import UploadComponent from './components/UploadComponent.jsx';
import DocumentList from './components/DocumentList.jsx';

export default function App() {
  const [userInput, setUserInput] = useState('');
  const [userId, setUserId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  function handleUserSubmit(event) {
    event.preventDefault();
    const owner = userInput.trim();
    if (!owner) {
      event.currentTarget.elements.userId.setCustomValidity('Informe um usuário.');
      event.currentTarget.elements.userId.reportValidity();
      return;
    }
    setUserId(owner);
    setRefreshKey((key) => key + 1);
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Gestão de documentos</h1>
      <p>O usuário define o proprietário dos documentos; não é uma autenticação.</p>
      <form onSubmit={handleUserSubmit}>
        <label htmlFor="user-id">Usuário </label>
        <input
          id="user-id"
          name="userId"
          value={userInput}
          required
          onChange={(event) => {
            event.target.setCustomValidity('');
            setUserInput(event.target.value);
          }}
        />
        <button type="submit">Carregar documentos</button>
      </form>
      {userId && (
        <div key={userId}>
          <p>Proprietário selecionado: <strong>{userId}</strong></p>
          <UploadComponent
            userId={userId}
            onUploaded={() => setRefreshKey((key) => key + 1)}
          />
          <DocumentList userId={userId} refreshKey={refreshKey} />
        </div>
      )}
    </main>
  );
}
