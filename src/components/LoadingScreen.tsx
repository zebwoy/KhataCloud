export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-600 flex items-center justify-center">
      <div className="text-center">
        <div className="relative inline-block mb-6">
          <div className="h-20 w-20 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-12 w-12 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-white">₹</span>
            </div>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Loading your data</h2>
        <p className="text-white/80 text-sm">Please wait while we fetch your transactions...</p>
      </div>
    </div>
  );
}
