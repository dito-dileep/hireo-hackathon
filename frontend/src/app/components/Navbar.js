export default function Navbar() {
  return (
    <nav className="flex justify-between items-center py-6 px-10 bg-white border-b border-gray-100">
      <div className="text-2xl font-black tracking-tighter text-black">
        HIREO.
      </div>
      <div className="space-x-8 text-sm font-medium text-gray-600">
        <a href="/" className="hover:text-black transition">
          Jobs
        </a>
        <a
          href="/assessment"
          className="hover:text-black transition text-blue-600 font-bold"
        >
          Try Assessment
        </a>
        <button className="bg-black text-white px-5 py-2 rounded-full hover:bg-gray-800 transition">
          Recruiter Login
        </button>
      </div>
    </nav>
  );
}
