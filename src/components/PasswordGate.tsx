import { useState } from 'react';

const PASSWORD_HASH = 'ethan';

interface Props {
  onAuth: () => void;
}

export default function PasswordGate({ onAuth }: Props) {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === PASSWORD_HASH) {
      sessionStorage.setItem('auth', 'true');
      onAuth();
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-lg p-8 w-80">
        <h1 className="text-lg font-bold text-white mb-1">Economic Governor</h1>
        <p className="text-xs text-gray-500 mb-6">Enter password to continue.</p>
        <input
          type="password"
          value={input}
          onChange={e => { setInput(e.target.value); setError(false); }}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 mb-3"
          placeholder="Password"
          autoFocus
        />
        {error && <p className="text-red-500 text-xs mb-3">Incorrect password.</p>}
        <button
          type="submit"
          className="w-full bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 rounded transition-colors"
        >
          Enter
        </button>
      </form>
    </div>
  );
}
