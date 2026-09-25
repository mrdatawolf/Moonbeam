import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="card p-5">
      <h1 className="text-xl font-semibold">This page doesn't exist.</h1>
      <p className="mt-2 text-sm">
        <Link to="/decisions" className="text-primary underline">
          Go to the decision queue
        </Link>{" "}
        or{" "}
        <Link to="/projects" className="text-primary underline">
          the project list
        </Link>
        .
      </p>
    </div>
  );
}
