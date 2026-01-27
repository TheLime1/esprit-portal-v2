"""
Custom exceptions for bbpy package.
"""


class BBError(Exception):
    """Base exception for bbpy package."""
    pass


class BBAuthError(BBError):
    """Raised when authentication fails."""
    pass


class BBAPIError(BBError):
    """Raised when an API request fails."""
    
    def __init__(self, message: str, status_code: int = None, response: str = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response
