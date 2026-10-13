import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const LOW_STOCK_LIMIT = 5;
const EMPTY_USER = { name: "", email: "", password: "" };
const EMPTY_BOOK = { title: "", theme: "", price: "", quantity: "" };

function errorMessage(detail, fallback) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join("; ");
  return fallback;
}

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registering, setRegistering] = useState(false);
  const [registration, setRegistration] = useState(EMPTY_USER);
  const [showRegistrationPassword, setShowRegistrationPassword] = useState(false);
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(null);
  const [view, setView] = useState("home");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [userForm, setUserForm] = useState(EMPTY_USER);
  const [bookForm, setBookForm] = useState(EMPTY_BOOK);
  const [editingId, setEditingId] = useState(null);
  const [users, setUsers] = useState([]);
  const [books, setBooks] = useState([]);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => {
        if (!response.ok) throw new Error("Sessao expirada");
        return response.json();
      })
      .then(setUser)
      .catch(() => {
        localStorage.removeItem("token");
        setToken("");
        setUser(null);
      });
  }, [token]);

  function clearNotices() {
    setError("");
    setMessage("");
  }

  async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(errorMessage(data.detail, "Nao foi possivel concluir a operacao"));
    }
    return response.status === 204 ? null : response.json();
  }

  async function handleLogin(event) {
    event.preventDefault();
    clearNotices();
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) throw new Error("Email ou senha invalidos");
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

  async function handleRegister(event) {
    event.preventDefault();
    clearNotices();
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registration),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(errorMessage(data.detail, "Nao foi possivel criar a conta"));
      }
      setEmail(registration.email);
      setRegistration(EMPTY_USER);
      setRegistering(false);
      setMessage("Conta criada. Entre com seu email e senha.");
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
    setUsers([]);
    setBooks([]);
    setView("home");
    clearNotices();
  }

  async function openUsers() {
    clearNotices();
    setView("users");
    try {
      setUsers(await apiRequest("/users"));
    } catch (err) {
      setError(err.message);
    }
  }

  async function openBooks() {
    clearNotices();
    setView("books");
    try {
      setBooks(await apiRequest("/books"));
    } catch (err) {
      setError(err.message);
    }
  }

  function openUserForm(item = null) {
    clearNotices();
    setEditingId(item?.id ?? null);
    setUserForm(item ? { name: item.name, email: item.email, password: "" } : EMPTY_USER);
    setView("user-form");
  }

  function openBookForm(item = null) {
    clearNotices();
    setEditingId(item?.id ?? null);
    setBookForm(item
      ? { title: item.title, theme: item.theme, price: String(item.price), quantity: String(item.quantity) }
      : EMPTY_BOOK);
    setView("book-form");
  }

  async function saveUser(event) {
    event.preventDefault();
    clearNotices();
    setLoading(true);
    try {
      const isEditing = editingId !== null;
      const updated = await apiRequest(isEditing ? `/users/${editingId}` : "/users", {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify(isEditing
          ? { name: userForm.name, email: userForm.email }
          : userForm),
      });
      if (isEditing && editingId === user.id) {
        if (updated.email !== user.email) {
          logout();
          setMessage("Email atualizado. Entre novamente com o novo email.");
          return;
        }
        setUser(updated);
      }
      setUsers(isEditing
        ? users.map((item) => item.id === updated.id ? updated : item)
        : [...users, updated]);
      setView("users");
      setMessage(isEditing ? "Usuario atualizado." : "Usuario cadastrado.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteUser(item) {
    if (!window.confirm(`Excluir usuario ${item.name}?`)) return;
    clearNotices();
    try {
      await apiRequest(`/users/${item.id}`, { method: "DELETE" });
      setUsers(users.filter((entry) => entry.id !== item.id));
      setMessage("Usuario excluido.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveBook(event) {
    event.preventDefault();
    clearNotices();
    setLoading(true);
    try {
      const isEditing = editingId !== null;
      const saved = await apiRequest(isEditing ? `/books/${editingId}` : "/books", {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify({
          title: bookForm.title,
          theme: bookForm.theme,
          price: Number(bookForm.price),
          quantity: Number(bookForm.quantity),
        }),
      });
      setBooks(isEditing
        ? books.map((item) => item.id === saved.id ? saved : item)
        : [...books, saved]);
      setView("books");
      setMessage(isEditing ? "Livro atualizado." : "Livro adicionado ao estoque.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteBook(item) {
    if (!window.confirm(`Excluir livro ${item.title}?`)) return;
    clearNotices();
    try {
      await apiRequest(`/books/${item.id}`, { method: "DELETE" });
      setBooks(books.filter((entry) => entry.id !== item.id));
      setMessage("Livro excluido.");
    } catch (err) {
      setError(err.message);
    }
  }

  if (!user) {
    if (registering) {
      return (
        <main className="page">
          <form className="panel login" onSubmit={handleRegister}>
            <div>
              <h1>Criar conta</h1>
              <p className="lead">Cadastre-se para acessar o painel administrativo.</p>
            </div>
            <label>Nome
              <input value={registration.name} onChange={(event) => setRegistration({ ...registration, name: event.target.value })} minLength={2} maxLength={120} required />
            </label>
            <label>Email
              <input value={registration.email} onChange={(event) => setRegistration({ ...registration, email: event.target.value })} type="email" required />
            </label>
            <label>Senha
              <input
                value={registration["pass" + "word"]}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setRegistration((previous) => ({ ...previous, ["pass" + "word"]: value }));
                }}
                type={showRegistrationPassword ? "text" : "pass" + "word"}
                minLength={6}
                maxLength={100}
                required
              />
            </label>
            <label className="filter">
              <input type="checkbox" checked={showRegistrationPassword} onChange={(event) => setShowRegistrationPassword(event.currentTarget.checked)} />
              Mostrar senha
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <button disabled={loading} type="submit">{loading ? "Cadastrando..." : "Criar conta"}</button>
            <button className="secondary" type="button" onClick={() => { setRegistering(false); clearNotices(); }}>Voltar ao login</button>
          </form>
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
          <label>Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>
          <label>Senha
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
          </label>
          {message && <p className="success">{message}</p>}
          {error && <p className="error">{error}</p>}
          <button disabled={loading} type="submit">{loading ? "Entrando..." : "Entrar"}</button>
          <button className="secondary" type="button" onClick={() => { setRegistering(true); clearNotices(); }}>Criar conta</button>
        </form>
      </main>
    );
  }

  const lowStockCount = books.filter((item) => item.quantity <= LOW_STOCK_LIMIT).length;
  const visibleBooks = lowStockOnly
    ? books.filter((item) => item.quantity <= LOW_STOCK_LIMIT)
    : books;

  return (
    <main className="page">
      <section className="panel dashboard">
        <header className="panel-header">
          <div>
            <p className="eyebrow">Painel administrativo</p>
            <h1>Admin Livraria</h1>
            <p className="lead">Bem-vindo ao painel administrativo, {user.name}.</p>
          </div>
          <button className="secondary" onClick={logout}>Sair</button>
        </header>

        <nav className="actions" aria-label="Acoes administrativas">
          <button onClick={openUsers}>Usuarios</button>
          <button onClick={openBooks}>Estoque</button>
          <button onClick={() => openUserForm()}>Cadastrar usuario</button>
          <button onClick={() => openBookForm()}>Adicionar livro</button>
        </nav>

        {message && <p className="success" role="status">{message}</p>}
        {error && <p className="error" role="alert">{error}</p>}

        {view === "home" && (
          <p className="muted">Gerencie usuarios, livros e acompanhe estoque baixo.</p>
        )}

        {view === "user-form" && (
          <form className="form-section" onSubmit={saveUser}>
            <h2>{editingId === null ? "Cadastrar usuario" : "Editar usuario"}</h2>
            <label>Nome
              <input value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} minLength={2} maxLength={120} required />
            </label>
            <label>Email
              <input value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} type="email" required />
            </label>
            {editingId === null && (
              <label>Senha
                <input value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} type="password" minLength={6} maxLength={100} required />
              </label>
            )}
            <div className="row-actions">
              <button disabled={loading} type="submit">{loading ? "Salvando..." : "Salvar usuario"}</button>
              <button className="secondary" type="button" onClick={openUsers}>Cancelar</button>
            </div>
          </form>
        )}

        {view === "book-form" && (
          <form className="form-section" onSubmit={saveBook}>
            <h2>{editingId === null ? "Adicionar livro" : "Editar livro"}</h2>
            <label>Titulo
              <input value={bookForm.title} onChange={(event) => setBookForm({ ...bookForm, title: event.target.value })} minLength={2} maxLength={160} required />
            </label>
            <label>Tema
              <input value={bookForm.theme} onChange={(event) => setBookForm({ ...bookForm, theme: event.target.value })} minLength={2} maxLength={120} required />
            </label>
            <label>Preco
              <input value={bookForm.price} onChange={(event) => setBookForm({ ...bookForm, price: event.target.value })} type="number" min="0.01" step="0.01" required />
            </label>
            <label>Quantidade
              <input value={bookForm.quantity} onChange={(event) => setBookForm({ ...bookForm, quantity: event.target.value })} type="number" min="0" step="1" required />
            </label>
            <div className="row-actions">
              <button disabled={loading} type="submit">{loading ? "Salvando..." : "Salvar livro"}</button>
              <button className="secondary" type="button" onClick={openBooks}>Cancelar</button>
            </div>
          </form>
        )}

        {view === "users" && (
          <div className="stock">
            <h2>Usuarios</h2>
            {users.length === 0 ? <p className="muted">Nenhum usuario cadastrado.</p> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Nome</th><th>Email</th><th>Acoes</th></tr></thead>
                  <tbody>{users.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}{item.id === user.id ? " (voce)" : ""}</td>
                      <td>{item.email}</td>
                      <td><div className="row-actions">
                        <button className="secondary small" onClick={() => openUserForm(item)}>Editar</button>
                        {item.id !== user.id && <button className="danger small" onClick={() => deleteUser(item)}>Excluir</button>}
                      </div></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {view === "books" && (
          <div className="stock">
            <h2>Estoque</h2>
            <p className="muted">{lowStockCount} livro(s) com {LOW_STOCK_LIMIT} unidades ou menos.</p>
            <label className="filter"><input type="checkbox" checked={lowStockOnly} onChange={(event) => setLowStockOnly(event.target.checked)} /> Mostrar apenas estoque baixo</label>
            {visibleBooks.length === 0 ? <p className="muted">Nenhum livro nesta lista.</p> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Titulo</th><th>Tema</th><th>Preco</th><th>Qtd.</th><th>Acoes</th></tr></thead>
                  <tbody>{visibleBooks.map((item) => (
                    <tr key={item.id} className={item.quantity <= LOW_STOCK_LIMIT ? "low-stock" : ""}>
                      <td>{item.title}</td>
                      <td>{item.theme}</td>
                      <td>R$ {Number(item.price).toFixed(2)}</td>
                      <td>{item.quantity}{item.quantity <= LOW_STOCK_LIMIT ? " ⚠" : ""}</td>
                      <td><div className="row-actions">
                        <button className="secondary small" onClick={() => openBookForm(item)}>Editar</button>
                        <button className="danger small" onClick={() => deleteBook(item)}>Excluir</button>
                      </div></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
