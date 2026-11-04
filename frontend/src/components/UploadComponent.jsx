import { useState } from 'react';
import { uploadDocument } from '../services/api.js';

export default function UploadComponent({ userId, onUploaded }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (uploading) return;
    setError('');
    setMessage('');
    if (!file || file.size === 0) {
      setError('Selecione um arquivo não vazio.');
      return;
    }

    const form = event.currentTarget;
    setUploading(true);
    try {
      await uploadDocument(file, userId);
      form.reset();
      setFile(null);
      setMessage('Documento enviado com sucesso.');
      onUploaded();
    } catch (error) {
      setError(error.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <section aria-labelledby="upload-title">
      <h2 id="upload-title">Enviar documento</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="document-file">Arquivo </label>
        <input
          id="document-file"
          type="file"
          required
          disabled={uploading}
          onChange={(event) => {
            setFile(event.target.files[0] ?? null);
            setError('');
            setMessage('');
          }}
        />
        <button type="submit" disabled={!file || uploading}>
          {uploading ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
