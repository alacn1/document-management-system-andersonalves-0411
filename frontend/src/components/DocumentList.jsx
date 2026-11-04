import { useEffect, useState } from 'react';
import { listDocuments } from '../services/api.js';
import DownloadButton from './DownloadButton.jsx';

export default function DocumentList({ userId, refreshKey }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');

    async function loadDocuments() {
      try {
        const result = await listDocuments(userId, controller.signal);
        if (!controller.signal.aborted) setDocuments(result);
      } catch (error) {
        if (!controller.signal.aborted) setError(error.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadDocuments();
    return () => controller.abort();
  }, [userId, refreshKey, retryKey]);

  return (
    <section aria-labelledby="documents-title" aria-busy={loading}>
      <h2 id="documents-title">Documentos</h2>
      <button type="button" disabled={loading} onClick={() => setRetryKey((key) => key + 1)}>
        Atualizar lista
      </button>
      {loading ? (
        <p role="status">Carregando documentos...</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : documents.length === 0 ? (
        <p>Nenhum documento encontrado.</p>
      ) : (
        <ul>
          {documents.map((document) => (
            <li key={document.id}>
              <p>
                <strong>{document.originalName}</strong>
                {' — '}{document.size.toLocaleString('pt-BR')} bytes
                {' — '}
                <time dateTime={document.uploadedAt}>
                  {new Date(document.uploadedAt).toLocaleString('pt-BR')}
                </time>
              </p>
              <DownloadButton document={document} userId={userId} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
