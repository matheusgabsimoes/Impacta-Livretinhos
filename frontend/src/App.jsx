import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(null);
  const [view, setView] = useState("home");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "" });
  const [book, setBook] = useState({ title: "", theme: "", price: "", quantity: "" });
  const [books, setBooks] = useState([]);
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Sessao expirada");
        }
        return response.json();
      })
      .then(setUser)
      .catch(() => {
        localStorage.removeItem("token");
        setToken("");
        setUser(null);
      });
  }, [token]);

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error("Email ou senha invalidos");
      }

      const data = await response.json();
      localStorage.setItem("token", data.access_token);
      setToken(data.access_token);
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setToken("");
    setUser(null);
    setView("home");
    setMessage("");
    setError("");
    setUsers([]);
    setBooks([]);
    setEditingUser(null);
  }

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  async function handleCreateUser(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/users`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(newUser),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Nao foi possivel cadastrar usuario");
      }

      const created = await response.json();
      setUsers((items) => [...items, created]);
      setNewUser({ name: "", email: "", password: "" });
      setView("users");
      setMessage("Usuario cadastrado com sucesso.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadUsers() {
    setError("");
    setMessage("");
    setEditingUser(null);
    setView("users");
    try {
      const response = await fetch(`${API_URL}/users`, { headers: authHeaders() });
      if (!response.ok) throw new Error("Nao foi possivel carregar usuarios");
      setUsers(await response.json());
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveUserEdit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/users/${editingUser.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ name: editingUser.name, email: editingUser.email }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Nao foi possivel atualizar usuario");
      }
      const updated = await response.json();
      if (updated.id === user.id && updated.email !== user.email) {
        logout();
        setMessage("Email atualizado. Entre novamente com novo email.");
        return;
      }
      if (updated.id === user.id) setUser(updated);
      setUsers((items) => items.map((item) => item.id === updated.id ? updated : item));
      setEditingUser(null);
      setMessage("Usuario atualizado.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteUser(item) {
    if (!window.confirm(`Excluir usuario ${item.name}?`)) return;
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/users/${item.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Nao foi possivel excluir usuario");
      }
      setUsers((items) => items.filter((entry) => entry.id !== item.id));
      setMessage("Usuario excluido.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateBook(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/books`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          title: book.title,
          theme: book.theme,
          price: Number(book.price),
          quantity: Number(book.quantity),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Nao foi possivel cadastrar livro");
      }

      setBook({ title: "", theme: "", price: "", quantity: "" });
      setMessage("Livro adicionado ao estoque.");
      await loadBooks();
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadBooks() {
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/books`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Nao foi possivel carregar o estoque");
      }

      const data = await response.json();
      setBooks(data);
    } catch (err) {
      setError(err.message);
    }
  }

  function openStockView() {
    setView("stock");
    loadBooks();
  }

  if (user) {
    return (
      <main className="page">
        <section className="panel dashboard">
          <header className="panel-header">
            <div>
              <p className="eyebrow">Painel administrativo</p>
              <h1>Admin Livraria</h1>
              <p className="lead">Bem-vindo ao painel administrativo, {user.name}.</p>
            </div>

            <button className="secondary" onClick={logout}>
              Sair
            </button>
          </header>

          <nav className="actions" aria-label="Acoes administrativas">
            <button onClick={() => setView("user")}>Cadastrar usuario</button>
            <button onClick={loadUsers}>Usuarios</button>
            <button onClick={() => setView("book")}>Adicionar livro</button>
            <button onClick={openStockView}>Verificar estoque</button>
          </nav>

          {message && <p className="success">{message}</p>}
          {error && <p className="error">{error}</p>}

          {view === "home" && (
            <p className="muted">
              Escolha uma acao para cadastrar usuarios, adicionar livros ou consultar o estoque.
            </p>
          )}

          {view === "user" && (
            <form className="form-section" onSubmit={handleCreateUser}>
              <h2>Cadastrar usuario</h2>
              <label>
                Nome
                <input
                  value={newUser.name}
                  onChange={(event) => setNewUser({ ...newUser, name: event.target.value })}
                  required
                />
              </label>
              <label>
                Email
                <input
                  value={newUser.email}
                  onChange={(event) => setNewUser({ ...newUser, email: event.target.value })}
                  required
                  type="email"
                />
              </label>
              <label>
                Senha
                <input
                  value={newUser.password}
                  onChange={(event) => setNewUser({ ...newUser, password: event.target.value })}
                  required
                  type="password"
                  minLength={6}
                />
              </label>
              <button type="submit">Salvar usuario</button>
            </form>
          )}

          {view === "users" && (
            <div className="stock">
              <h2>Usuarios</h2>
              {editingUser && (
                <form className="form-section" onSubmit={saveUserEdit}>
                  <label>Nome
                    <input value={editingUser.name} onChange={(event) => setEditingUser({ ...editingUser, name: event.target.value })} minLength={2} maxLength={120} required />
                  </label>
                  <label>Email
                    <input value={editingUser.email} onChange={(event) => setEditingUser({ ...editingUser, email: event.target.value })} type="email" required />
                  </label>
                  <div className="row-actions">
                    <button type="submit">Salvar alteracoes</button>
                    <button className="secondary" type="button" onClick={() => setEditingUser(null)}>Cancelar</button>
                  </div>
                </form>
              )}
              {users.length === 0 ? <p className="muted">Nenhum usuario cadastrado.</p> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Nome</th><th>Email</th><th>Acoes</th></tr></thead>
                    <tbody>{users.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}{item.id === user.id ? " (voce)" : ""}</td>
                        <td>{item.email}</td>
                        <td><div className="row-actions">
                          <button className="secondary small" onClick={() => setEditingUser(item)}>Editar</button>
                          {item.id !== user.id && <button className="danger small" onClick={() => deleteUser(item)}>Excluir</button>}
                        </div></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {view === "book" && (
            <form className="form-section" onSubmit={handleCreateBook}>
              <h2>Adicionar livro</h2>
              <label>
                Titulo
                <input
                  value={book.title}
                  onChange={(event) => setBook({ ...book, title: event.target.value })}
                  required
                />
              </label>
              <label>
                Tema
                <input
                  value={book.theme}
                  onChange={(event) => setBook({ ...book, theme: event.target.value })}
                  required
                />
              </label>
              <label>
                Preco
                <input
                  value={book.price}
                  onChange={(event) => setBook({ ...book, price: event.target.value })}
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                />
              </label>
              <label>
                Quantidade
                <input
                  value={book.quantity}
                  onChange={(event) => setBook({ ...book, quantity: event.target.value })}
                  required
                  type="number"
                  min="0"
                  step="1"
                />
              </label>
              <button type="submit">Adicionar ao estoque</button>
            </form>
          )}

          {view === "stock" && (
            <div className="stock">
              <h2>Estoque</h2>
              {books.length === 0 ? (
                <p className="muted">Nenhum livro cadastrado ainda.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Titulo</th>
                        <th>Tema</th>
                        <th>Preco</th>
                        <th>Qtd.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {books.map((item) => (
                        <tr key={item.id}>
                          <td>{item.title}</td>
                          <td>{item.theme}</td>
                          <td>R$ {Number(item.price).toFixed(2)}</td>
                          <td>{item.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <form className="panel login" onSubmit={handleLogin}>
        <div>
          <h1>Admin Livraria</h1>
          <p className="lead">Entre com email e senha para acessar o painel.</p>
        </div>

        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
        </label>

        <label>
          Senha
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button disabled={loading} type="submit">
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
