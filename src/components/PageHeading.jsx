export default function PageHeading({ title, description, children }) {
  return <header className="sc-page-heading">
    <h1>{title}</h1>
    {children && <div className="sc-page-actions">{children}</div>}
    <p className="sc-page-description">{description}</p>
  </header>
}
