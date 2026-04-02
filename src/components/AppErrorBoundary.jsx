import { Component } from 'react'

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Application render error:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-lg border border-slate-200 p-8">
            <h1 className="text-2xl font-bold text-slate-800 mb-3">Something went wrong</h1>
            <p className="text-slate-600 mb-4">
              CareLink hit an error while rendering this page. Refresh to try again.
            </p>
            {this.state.error?.message ? (
              <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {this.state.error.message}
              </div>
            ) : null}
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default AppErrorBoundary
