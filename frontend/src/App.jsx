import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const LOW_STOCK_LIMIT = 5;
const ITEMS_PER_PAGE = 10;
const EMPTY_USER = { name: "", email: "", password: "" };
const EMPTY_BOOK = { title: "", theme: "", price: "", quantity: "" };

function errorMessage(detail, fallback) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join("; ");
  return fallback;
}

function Pagination({ page, pageCount, onPageChange }) {
  if (pageCount <= 1) return null;

  return (
    <nav className="pagination" aria-label="Paginação">
      <button disabled={page === 1} type="button" onClick={() => onPageChange(page - 1)}>Anterior</button>
      <span>Página {page} de {pageCount}</span>
      <button disabled={page === pageCount} type="button" onClick={() => onPageChange(page + 1)}>Próxima</button>
    </nav>
  );
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
  const [userPage, setUserPage] = useState(1);
  const [bookPage, setBookPage] = useState(1);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => {
        if (!response.ok) throw new Error("Sessão expirada");
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
      throw new Error(errorMessage(data.detail, "Não foi possível concluir a operação"));
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
      if (!response.ok) throw new Error("Email ou senha inválidos");
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
        throw new Error(errorMessage(data.detail, "Não foi possível criar a conta"));
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
    setUserPage(1);
    setBookPage(1);
    setView("home");
    clearNotices();
  }

  async function openUsers() {
    clearNotices();
    setView("users");
    setUserPage(1);
    try {
      setUsers(await apiRequest("/users"));
    } catch (err) {
      setError(err.message);
    }
  }

  async function openBooks() {
    clearNotices();
    setView("books");
    setBookPage(1);
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
      setUserPage(1);
      setView("users");
      setMessage(isEditing ? "Usuário atualizado." : "Usuário cadastrado.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteUser(item) {
    if (!window.confirm(`Excluir usuário ${item.name}?`)) return;
    clearNotices();
    try {
      await apiRequest(`/users/${item.id}`, { method: "DELETE" });
      setUsers(users.filter((entry) => entry.id !== item.id));
      setUserPage(1);
      setMessage("Usuário excluído.");
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
      setBookPage(1);
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
      setBookPage(1);
      setMessage("Livro excluído.");
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
            <h1>Livretinhos</h1>
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
  const userPageCount = Math.max(1, Math.ceil(users.length / ITEMS_PER_PAGE));
  const bookPageCount = Math.max(1, Math.ceil(visibleBooks.length / ITEMS_PER_PAGE));
  const pagedUsers = users.slice((userPage - 1) * ITEMS_PER_PAGE, userPage * ITEMS_PER_PAGE);
  const pagedBooks = visibleBooks.slice((bookPage - 1) * ITEMS_PER_PAGE, bookPage * ITEMS_PER_PAGE);

  return (
    <main className="page">
        <section className="panel dashboard">
          <aside className="sidebar">
            <div>
              <p className="eyebrow">Painel administrativo</p>
              <h1>Livretinhos</h1>
            </div>
            <nav className="sidebar-nav" aria-label="Navegação administrativa">
              <button className={view === "home" ? "active" : ""} type="button" onClick={() => { clearNotices(); setView("home"); }}>Início</button>
              <button className={view === "users" || view === "user-form" ? "active" : ""} type="button" onClick={openUsers}>Usuários</button>
              <button className={view === "books" || view === "book-form" ? "active" : ""} type="button" onClick={openBooks}>Estoque</button>
            </nav>
            <button className="secondary logout" type="button" onClick={logout}>Sair</button>
          </aside>

          <div className="dashboard-content">
            <header className="panel-header">
              <p className="lead">Bem-vindo ao painel administrativo, {user.name}.</p>
            </header>

            {message && <p className="success" role="status">{message}</p>}
            {error && <p className="error" role="alert">{error}</p>}

            {view === "home" && (
              <p className="muted">Gerencie usuários, livros e acompanhe estoque baixo.</p>
            )}

            {view === "user-form" && (
              <form className="form-section" onSubmit={saveUser}>
                <h2>{editingId === null ? "Cadastrar usuário" : "Editar usuário"}</h2>
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
                <button disabled={loading} type="submit">{loading ? "Salvando..." : "Salvar usuário"}</button>
                <button className="secondary" type="button" onClick={openUsers}>Cancelar</button>
              </div>
            </form>
        )}

        {view === "book-form" && (
            <form className="form-section" onSubmit={saveBook}>
              <h2>{editingId === null ? "Adicionar livro" : "Editar livro"}</h2>
              <label>Título
              <input value={bookForm.title} onChange={(event) => setBookForm({ ...bookForm, title: event.target.value })} minLength={2} maxLength={160} required />
            </label>
            <label>Tema
              <input value={bookForm.theme} onChange={(event) => setBookForm({ ...bookForm, theme: event.target.value })} minLength={2} maxLength={120} required />
            </label>
              <label>Preço
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
                <div className="section-header">
                  <h2>Usuários</h2>
                  <button type="button" onClick={() => openUserForm()}>Cadastrar usuário</button>
                </div>
                {users.length === 0 ? <p className="muted">Nenhum usuário cadastrado.</p> : (
               <div className="table-wrap">
                 <table>
                  <thead><tr><th>Nome</th><th>Email</th><th>Ações</th></tr></thead>
                  <tbody>{pagedUsers.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}{item.id === user.id ? " (você)" : ""}</td>
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
                <Pagination page={userPage} pageCount={userPageCount} onPageChange={setUserPage} />
          </div>
        )}

        {view === "books" && (
          <div className="stock">
            <div className="section-header">
              <h2>Estoque</h2>
              <button type="button" onClick={() => openBookForm()}>Adicionar livro</button>
            </div>
            <p className="muted">{lowStockCount} livro(s) com {LOW_STOCK_LIMIT} unidades ou menos.</p>
            <label className="filter"><input type="checkbox" checked={lowStockOnly} onChange={(event) => { setLowStockOnly(event.target.checked); setBookPage(1); }} /> Mostrar apenas estoque baixo</label>
            {visibleBooks.length === 0 ? <p className="muted">Nenhum livro nesta lista.</p> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Título</th><th>Tema</th><th>Preço</th><th>Qtd.</th><th>Ações</th></tr></thead>
                  <tbody>{pagedBooks.map((item) => (
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
            <Pagination page={bookPage} pageCount={bookPageCount} onPageChange={setBookPage} />
          </div>
            )}
          </div>
        </section>
    </main>
  );
}
