"""
Main BBClient class for interacting with Blackboard API.
"""

import json
from pathlib import Path
from typing import Optional, List, Dict, Any

import requests

from bbpy.auth import login_with_selenium, save_id_file, load_id_file, update_id_file_cookies
from bbpy.exceptions import BBAuthError, BBAPIError


class BBClient:
    """
    Blackboard API Client.
    
    Provides methods to interact with the Blackboard Learn API including:
    - Get enrolled courses
    - Get instructor/professor data
    - Get attendance records
    
    Usage:
        # With existing .id file
        client = BBClient(id_path="username.id")
        
        # With credentials (auto-login via Selenium)
        client = BBClient(username="user", password="pass")
        
        # Get enrolled courses
        courses = client.get_enrolled_courses()
    """
    
    DEFAULT_DOMAIN = "https://esprit.blackboard.com"
    
    def __init__(
        self,
        id_path: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        domain: str = DEFAULT_DOMAIN,
        auto_refresh: bool = True
    ):
        """
        Initialize the Blackboard client.
        
        Args:
            id_path: Path to .id file (contains cookies and cached user/course data)
            username: Blackboard username (for Selenium login)
            password: Blackboard password (for Selenium login)
            domain: Blackboard domain URL
            auto_refresh: If True and session is expired, auto-login with credentials
        """
        self.domain = domain
        self.api_url = f"{domain}/learn/api/public/v1"
        self.session: Optional[requests.Session] = None
        self._user_id: Optional[str] = None
        self._username = username
        self._password = password
        self._id_path = id_path
        self._auto_refresh = auto_refresh
        self._cached_data: Optional[dict] = None  # Cached user/course data from .id file
        
        # Authenticate
        if id_path and Path(id_path).exists():
            self.session, self._cached_data = load_id_file(id_path)
            
            # Use stored credentials if not provided
            stored_creds = self._cached_data.get("credentials")
            if stored_creds and not self._username:
                self._username = stored_creds.get("username")
                self._password = stored_creds.get("password")
            
            # Validate session, auto-refresh if expired and credentials available
            try:
                self._validate_auth()
            except BBAuthError as e:
                if auto_refresh and self._username and self._password:
                    print(f"⚠️  Session expired, auto-refreshing with Selenium login...")
                    self._refresh_authentication()
                else:
                    # Provide helpful error message
                    error_msg = f"Authentication failed: {e}\n\n"
                    error_msg += "Your session may have expired. "
                    if not self._username or not self._password:
                        error_msg += "Please either:\n"
                        error_msg += f"  1. Provide username/password: BBClient(id_path='{id_path}', username='...', password='...', auto_refresh=True)\n"
                        error_msg += "  2. Re-login with Selenium to generate a fresh .id file"
                    raise BBAuthError(error_msg)
                    
        elif username and password:
            self._refresh_authentication()
        else:
            raise BBAuthError(
                "Must provide either id_path or username/password for authentication"
            )
    
    def _refresh_authentication(self) -> None:
        """Refresh authentication using Selenium login."""
        if not self._username or not self._password:
            raise BBAuthError("Cannot refresh: username or password not provided")
        
        print("🔄 Refreshing authentication with Selenium...")
        self.session = login_with_selenium(self._username, self._password, self.domain)
        
        # Validate the new session first
        self._validate_auth()
        
        # Determine if we have an existing .id file with cached data
        has_existing_id = self._id_path and Path(self._id_path).exists()
        
        if has_existing_id:
            # Update only cookies, keep existing user/course data
            print(f"📝 Updating cookies in existing .id file: {self._id_path}")
            update_id_file_cookies(self._id_path, self.session)
            print("✅ Cookies refreshed successfully!")
            
            # Reload the .id file to populate cached data
            _, self._cached_data = load_id_file(self._id_path)
        else:
            # Generate full .id file with user data and courses
            if self._id_path:
                self.generate_id_file(self._id_path)
            elif self._username:
                # Default to username.id
                id_file = f"{self._username}.id"
                self.generate_id_file(id_file)
                self._id_path = id_file
        
        # Update isNerd and isAttending stats
        print("📊 Updating stats (isNerd, isAttending)...")
        try:
            self.is_nerd()
            self.is_attending()
            print("✅ Stats updated!")
        except Exception:
            print("⚠️ Could not update stats (API may be slow)")


    
    def generate_id_file(self, id_path: str) -> None:
        """
        Generate an enriched .id file with cookies, user data, and course information.
        
        Args:
            id_path: Path to save the .id file
        """
        print(f"📝 Generating .id file: {id_path}")
        
        # Get user data
        user_data = self.get_current_user()
        
        # Get enrolled courses
        courses = self.get_enrolled_courses()
        
        # Get instructors
        instructors = self.get_course_instructors()
        
        # Save the .id file (with credentials for future auto-refresh)
        save_id_file(
            id_path, self.session, user_data, courses, instructors,
            username=self._username, password=self._password
        )
        
        # Update cached data
        self._cached_data = {
            "user": {
                "name": f"{user_data.get('name', {}).get('given', '')} {user_data.get('name', {}).get('family', '')}".strip(),
                "username": user_data.get("userName", ""),
                "email": user_data.get("contact", {}).get("email", ""),
                "class": courses[0].get("name", "").split("__")[1] if courses and "__" in courses[0].get("name", "") else None
            },
            "courses": courses,
            "credentials": {"username": self._username, "password": self._password} if self._username else None
        }
        
        print(f"✅ .id file generated successfully!")
    
    def get_cached_data(self) -> Optional[dict]:
        """
        Get cached user and course data from .id file.
        
        Returns:
            Cached data dictionary or None if not available
        """
        return self._cached_data
    
    def _validate_auth(self) -> None:
        """Validate that authentication is working."""
        try:
            user_data = self._get("/users/me")
            self._user_id = user_data.get("id")
        except BBAPIError as e:
            if e.status_code == 401:
                raise BBAuthError("Cookie has expired or is invalid (401 Unauthorized)")
            raise BBAuthError(f"Authentication validation failed: {e}")
    
    def _get(self, endpoint: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Make a GET request to the API.
        
        Args:
            endpoint: API endpoint (without base URL)
            params: Query parameters
            
        Returns:
            JSON response as dictionary
            
        Raises:
            BBAPIError: If request fails
        """
        url = f"{self.api_url}{endpoint}"
        
        try:
            response = self.session.get(url, params=params)
            
            if response.status_code == 200:
                return response.json()
            else:
                raise BBAPIError(
                    f"API request failed: {endpoint}",
                    status_code=response.status_code,
                    response=response.text
                )
        except requests.RequestException as e:
            raise BBAPIError(f"Request error: {e}")
    
    def _get_paginated(self, endpoint: str, params: Optional[Dict] = None) -> List[Dict]:
        """
        Make paginated GET requests and return all results.
        
        Args:
            endpoint: API endpoint
            params: Query parameters
            
        Returns:
            List of all results across pages
        """
        all_results = []
        params = params or {}
        
        while True:
            data = self._get(endpoint, params)
            results = data.get("results", [])
            all_results.extend(results)
            
            # Check for next page
            paging = data.get("paging", {})
            next_page = paging.get("nextPage")
            
            if not next_page:
                break
            
            # Extract offset from next page URL
            # nextPage format: "/learn/api/public/v1/...?offset=X"
            if "offset=" in next_page:
                offset = next_page.split("offset=")[-1].split("&")[0]
                params["offset"] = offset
            else:
                break
        
        return all_results
    
    def _get_v2(self, endpoint: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Make a GET request to the v2 API.
        
        Args:
            endpoint: API endpoint (without base URL)
            params: Query parameters
            
        Returns:
            JSON response as dictionary
        """
        url = f"{self.domain}/learn/api/public/v2{endpoint}"
        
        try:
            response = self.session.get(url, params=params)
            
            if response.status_code == 200:
                return response.json()
            else:
                raise BBAPIError(
                    f"API v2 request failed: {endpoint}",
                    status_code=response.status_code,
                    response=response.text
                )
        except requests.RequestException as e:
            raise BBAPIError(f"Request error: {e}")
    
    def _get_paginated_v2(self, endpoint: str, params: Optional[Dict] = None) -> List[Dict]:
        """
        Make paginated GET requests to v2 API and return all results.
        
        Args:
            endpoint: API endpoint
            params: Query parameters
            
        Returns:
            List of all results across pages
        """
        all_results = []
        params = params or {}
        
        while True:
            data = self._get_v2(endpoint, params)
            results = data.get("results", [])
            all_results.extend(results)
            
            # Check for next page
            paging = data.get("paging", {})
            next_page = paging.get("nextPage")
            
            if not next_page:
                break
            
            if "offset=" in next_page:
                offset = next_page.split("offset=")[-1].split("&")[0]
                params["offset"] = offset
            else:
                break
        
        return all_results
    
    def get_course_assignments(self, course_id: str) -> List[Dict[str, Any]]:
        """
        Get all assignments for a specific course.
        
        Args:
            course_id: Internal course ID (e.g., "_123456_1")
            
        Returns:
            List of assignment dictionaries with:
            - id: Gradebook column ID
            - name: Assignment name
            - course_id: Internal course ID
            - course_name: Course name (if available)
            - due: Due date (ISO format) or None
            - score_possible: Maximum possible score
            - score: User's score or None
            - status: "NotSubmitted", "Submitted", "Graded"
            - submitted: Whether user has submitted
            - graded: Whether assignment has been graded
            - is_past_due: Whether current date is after due date
            - grading_type: "Attempts", "Manual", or "Calculated"
        """
        from datetime import datetime
        
        assignments = []
        
        try:
            # Get gradebook columns from v2 API
            columns = self._get_paginated_v2(f"/courses/{course_id}/gradebook/columns")
        except BBAPIError:
            # Course might not have gradebook or we don't have access
            return []
        
        # Get course name from cached data if available
        course_name = None
        if self._cached_data:
            for course in self._cached_data.get("courses", []):
                # Match by checking if course_id contains the cached course_id
                if course.get("course_id") and course.get("course_id") in str(course_id):
                    course_name = course.get("name")
                    break
        
        for column in columns:
            column_id = column.get("id")
            grading = column.get("grading", {})
            grading_type = grading.get("type", "Manual")
            
            # Skip calculated columns (like Total, Weighted Total)
            if grading_type == "Calculated":
                continue
            
            # Get due date
            due = grading.get("due")
            
            # Determine if past due
            is_past_due = False
            if due:
                try:
                    due_dt = datetime.fromisoformat(due.replace("Z", "+00:00"))
                    is_past_due = datetime.now(due_dt.tzinfo) > due_dt
                except (ValueError, TypeError):
                    pass
            
            # Get user's grade for this column
            score = None
            status = "NotSubmitted"
            graded = False
            submitted = False
            
            try:
                grade_url = f"/courses/{course_id}/gradebook/columns/{column_id}/users/{self._user_id}"
                grade = self._get(grade_url)
                
                grade_status = grade.get("status")
                score = grade.get("score")
                
                if grade_status == "Graded":
                    status = "Graded"
                    graded = True
                    submitted = True
                elif grade_status == "NeedsGrading":
                    status = "Submitted"
                    submitted = True
                elif grade_status:
                    # Has some status but not graded
                    status = grade_status
                    submitted = True
                elif score is not None:
                    # Has score but no status (shouldn't happen often)
                    status = "Graded"
                    graded = True
                    submitted = True
                # If no grade record exists, status remains "NotSubmitted"
                    
            except BBAPIError:
                # No grade record - not submitted
                pass
            
            # Check if late submissions are allowed (fetch content info)
            accepts_late = True  # Default to true
            content_id = column.get("contentId")
            if content_id:
                try:
                    content = self._get(f"/courses/{course_id}/contents/{content_id}")
                    handler = content.get("contentHandler", {})
                    # isLateAttemptCreationDisallowed = true means late NOT allowed
                    accepts_late = not handler.get("isLateAttemptCreationDisallowed", False)
                except BBAPIError:
                    pass
            
            assignment = {
                "id": column_id,
                "content_id": content_id,  # Content ID used in Blackboard URLs
                "name": column.get("name", "Unknown"),
                "course_id": course_id,
                "course_name": course_name,
                "due": due,
                "score_possible": column.get("score", {}).get("possible"),
                "score": score,
                "status": status,
                "submitted": submitted,
                "graded": graded,
                "is_past_due": is_past_due,
                "accepts_late": accepts_late,  # Can student submit after due date?
                "grading_type": grading_type
            }
            
            assignments.append(assignment)
        
        return assignments
    
    def get_assignments(self) -> List[Dict[str, Any]]:
        """
        Get all assignments from all courses in the .id file.
        
        Uses cached course data from the .id file to iterate over courses,
        then fetches assignments for each course.
        
        Returns:
            List of assignment dictionaries (same format as get_course_assignments)
        """
        all_assignments = []
        
        if not self._cached_data:
            return []
        
        courses = self._cached_data.get("courses", [])
        
        # Get assignments for each cached course using internal_id
        for cached_course in courses:
            internal_id = cached_course.get("internal_id")  # e.g., "_123456_1"
            course_name = cached_course.get("name")
            
            if not internal_id:
                # Old .id file format without internal_id - skip or try matching
                continue
            
            try:
                course_assignments = self.get_course_assignments(internal_id)
                
                # Update course_name if not set
                for assignment in course_assignments:
                    if not assignment.get("course_name"):
                        assignment["course_name"] = course_name
                
                all_assignments.extend(course_assignments)
            except BBAPIError:
                # Skip courses we can't access
                continue
        
        return all_assignments
    
    def get_current_user(self) -> Dict[str, Any]:
        """
        Get current authenticated user information.
        
        Returns:
            User data dictionary
        """
        return self._get("/users/me")
    
    def get_enrolled_courses(self) -> List[Dict[str, Any]]:
        """
        Get all enrolled courses for the current user.
        
        A course is considered "enrolled" if it has an "externalAccessUrl" field.
        
        Returns:
            List of enrolled course dictionaries
        """
        # Get user's course memberships
        memberships = self._get_paginated(f"/users/{self._user_id}/courses")
        
        enrolled_courses = []
        
        for membership in memberships:
            course_id = membership.get("courseId")
            if not course_id:
                continue
            
            try:
                # Get full course details
                course = self._get(f"/courses/{course_id}")
                
                # Check if enrolled (has externalAccessUrl)
                if course.get("externalAccessUrl"):
                    # Add membership info to course data
                    course["membership"] = membership
                    enrolled_courses.append(course)
            except BBAPIError:
                # Skip courses that can't be accessed
                continue
        
        return enrolled_courses
    
    def get_course_instructors(self, course_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get instructor/professor data for courses.
        
        Args:
            course_id: Specific course ID (optional). 
                       If None, returns instructors for all enrolled courses.
        
        Returns:
            List of instructor data dictionaries with course info
        """
        if course_id:
            return self._get_course_instructors_single(course_id)
        
        # Get instructors for all enrolled courses
        courses = self.get_enrolled_courses()
        all_instructors = []
        
        for course in courses:
            course_id = course.get("id")
            instructors = self._get_course_instructors_single(course_id)
            
            for instructor in instructors:
                instructor["course"] = {
                    "id": course_id,
                    "name": course.get("name"),
                    "courseId": course.get("courseId")
                }
                all_instructors.append(instructor)
        
        return all_instructors
    
    def _get_course_instructors_single(self, course_id: str) -> List[Dict[str, Any]]:
        """Get instructors for a single course."""
        try:
            # Get course memberships and filter by role
            memberships = self._get_paginated(f"/courses/{course_id}/users")
            
            instructors = []
            for member in memberships:
                role = member.get("courseRoleId", "")
                # Instructors typically have roles like "Instructor", "TeachingAssistant"
                if role in ["Instructor", "TeachingAssistant", "Grader", "CourseBuilder"]:
                    user_id = member.get("userId")
                    
                    try:
                        # Get user details
                        user_data = self._get(f"/users/{user_id}")
                        user_data["courseRole"] = role
                        instructors.append(user_data)
                    except BBAPIError:
                        # Include basic info if full details unavailable
                        instructors.append({
                            "userId": user_id,
                            "courseRole": role,
                            "name": member.get("name", {})
                        })
            
            return instructors
        except BBAPIError:
            return []
    
    def get_attendance(self, course_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get attendance/presence records for courses.
        
        Args:
            course_id: Specific course ID (optional).
                       If None, returns attendance for all enrolled courses.
        
        Returns:
            List of attendance records with course info
        """
        if course_id:
            return self._get_course_attendance(course_id)
        
        # Get attendance for all enrolled courses
        courses = self.get_enrolled_courses()
        all_attendance = []
        
        for course in courses:
            cid = course.get("id")
            attendance = self._get_course_attendance(cid)
            
            for record in attendance:
                record["course"] = {
                    "id": cid,
                    "name": course.get("name"),
                    "courseId": course.get("courseId")
                }
                all_attendance.append(record)
        
        return all_attendance
    
    def _get_course_attendance(self, course_id: str) -> List[Dict[str, Any]]:
        """Get attendance records for a single course."""
        try:
            # Try to get course meetings (attendance)
            meetings = self._get_paginated(f"/courses/{course_id}/meetings")
            
            attendance_records = []
            for meeting in meetings:
                meeting_id = meeting.get("id")
                
                try:
                    # Get attendance for this meeting
                    attendance = self._get(
                        f"/courses/{course_id}/meetings/{meeting_id}/users/{self._user_id}"
                    )
                    attendance["meeting"] = meeting
                    attendance_records.append(attendance)
                except BBAPIError:
                    # Include meeting without user-specific attendance
                    attendance_records.append({
                        "meeting": meeting,
                        "status": "unknown"
                    })
            
            return attendance_records
        except BBAPIError:
            # Attendance API might not be available for all courses
            return []
    
    def get_course_attendance_percentage(self, course_id: str) -> Dict[str, Any]:
        """
        Get attendance percentage for a specific course.
        
        Args:
            course_id: Internal course ID
            
        Returns:
            Dict with present, absent, total counts and percentage
        """
        attendance = self._get_course_attendance(course_id)
        
        present = 0
        absent = 0
        total = len(attendance)
        
        for record in attendance:
            status = record.get("status", "").lower()
            if status in ["present", "late", "excused"]:
                present += 1
            elif status in ["absent"]:
                absent += 1
            # Unknown status counts as neither
        
        percentage = (present / total * 100) if total > 0 else 0.0
        
        # Get course name from cached data
        course_name = None
        if self._cached_data:
            for c in self._cached_data.get("courses", []):
                if c.get("internal_id") == course_id:
                    course_name = c.get("name")
                    break
        
        return {
            "course_id": course_id,
            "course_name": course_name,
            "present": present,
            "absent": absent,
            "total": total,
            "percentage": round(percentage, 2)
        }
    
    def get_attendance_percentage(self) -> Dict[str, Any]:
        """
        Get attendance percentage across all courses.
        
        Returns:
            Dict with per-course stats and overall average
        """
        if not self._cached_data:
            return {"courses": [], "overall": {"percentage": 0.0}}
        
        courses = self._cached_data.get("courses", [])
        course_stats = []
        total_present = 0
        total_absent = 0
        total_meetings = 0
        
        for course in courses:
            internal_id = course.get("internal_id")
            if not internal_id:
                continue
            
            stats = self.get_course_attendance_percentage(internal_id)
            stats["course_name"] = course.get("name")
            course_stats.append(stats)
            
            total_present += stats["present"]
            total_absent += stats["absent"]
            total_meetings += stats["total"]
        
        overall_percentage = (total_present / total_meetings * 100) if total_meetings > 0 else 0.0
        
        return {
            "courses": course_stats,
            "overall": {
                "present": total_present,
                "absent": total_absent,
                "total": total_meetings,
                "percentage": round(overall_percentage, 2)
            }
        }
    
    def get_course_assignment_stats(self, course_id: str) -> Dict[str, Any]:
        """
        Get assignment submission statistics for a specific course.
        
        Args:
            course_id: Internal course ID
            
        Returns:
            Dict with on_time, late, missed, available counts and rates
            - on_time: Submitted before due date
            - late: Submitted after due date  
            - missed: Not submitted + past due + doesn't accept late
            - available: Not submitted + (not past due OR accepts late)
        """
        from datetime import datetime
        
        assignments = self.get_course_assignments(course_id)
        
        total = len(assignments)
        on_time = 0
        late = 0
        missed = 0
        available = 0
        
        for a in assignments:
            submitted = a.get("submitted", False)
            is_past_due = a.get("is_past_due", False)
            accepts_late = a.get("accepts_late", True)
            score = a.get("score")
            graded = a.get("graded", False)
            
            # Check if graded with 0 = missed (professor gave 0 for non-submission)
            if graded and score == 0:
                missed += 1
            elif submitted:
                # Actually submitted
                if not is_past_due:
                    on_time += 1
                else:
                    # Submitted but past due = late
                    late += 1
            else:
                # Not submitted
                if is_past_due and not accepts_late:
                    # Past due AND can't submit late = missed (impossible to submit)
                    missed += 1
                else:
                    # Not past due OR can still submit late = available
                    available += 1
        
        on_time_rate = (on_time / total) if total > 0 else 0.0
        
        # Get course name
        course_name = None
        for a in assignments:
            if a.get("course_name"):
                course_name = a.get("course_name")
                break
        
        return {
            "course_id": course_id,
            "course_name": course_name,
            "total": total,
            "on_time": on_time,
            "late": late,
            "missed": missed,
            "available": available,
            "on_time_rate": round(on_time_rate, 2)
        }
    
    def get_assignment_stats(self) -> Dict[str, Any]:
        """
        Get assignment statistics across all courses.
        
        Returns:
            Dict with per-course stats and overall aggregates
        """
        if not self._cached_data:
            return {"courses": [], "overall": {"on_time_rate": 0.0}}
        
        courses = self._cached_data.get("courses", [])
        course_stats = []
        total_all = 0
        on_time_all = 0
        late_all = 0
        missed_all = 0
        available_all = 0
        
        for course in courses:
            internal_id = course.get("internal_id")
            if not internal_id:
                continue
            
            try:
                stats = self.get_course_assignment_stats(internal_id)
                stats["course_name"] = course.get("name")
                course_stats.append(stats)
                
                total_all += stats["total"]
                on_time_all += stats["on_time"]
                late_all += stats["late"]
                missed_all += stats["missed"]
                available_all += stats["available"]
            except BBAPIError:
                continue
        
        on_time_rate = (on_time_all / total_all) if total_all > 0 else 0.0
        
        return {
            "courses": course_stats,
            "overall": {
                "total": total_all,
                "on_time": on_time_all,
                "late": late_all,
                "missed": missed_all,
                "available": available_all,
                "on_time_rate": round(on_time_rate, 2)
            }
        }
    
    def is_nerd(self) -> bool:
        """
        Check if student is a 'nerd' (on-time rate > 45%).
        Updates the .id file with isNerd flag.
        
        Returns:
            True if on-time rate > 45%
        """
        import json
        
        stats = self.get_assignment_stats()
        on_time_rate = stats["overall"].get("on_time_rate", 0)
        is_nerd = on_time_rate > 0.45
        
        # Update .id file
        if self._id_path:
            try:
                with open(self._id_path, 'r', encoding='utf-8') as f:
                    id_data = json.load(f)
                
                id_data["isNerd"] = is_nerd
                id_data["on_time_rate"] = on_time_rate
                
                with open(self._id_path, 'w', encoding='utf-8') as f:
                    json.dump(id_data, f, indent=2, ensure_ascii=False)
            except Exception:
                pass
        
        return is_nerd
    
    def is_attending(self) -> bool:
        """
        Check if student is 'attending' (attendance > 60%).
        Updates the .id file with isAttending flag.
        
        Returns:
            True if attendance > 60%
        """
        import json
        
        stats = self.get_attendance_percentage()
        percentage = stats["overall"].get("percentage", 0)
        is_attending = percentage > 60
        
        # Update .id file
        if self._id_path:
            try:
                with open(self._id_path, 'r', encoding='utf-8') as f:
                    id_data = json.load(f)
                
                id_data["isAttending"] = is_attending
                id_data["attendance_percentage"] = percentage
                
                with open(self._id_path, 'w', encoding='utf-8') as f:
                    json.dump(id_data, f, indent=2, ensure_ascii=False)
            except Exception:
                pass
        
        return is_attending
    
    def __repr__(self) -> str:
        return f"BBClient(domain='{self.domain}', user_id='{self._user_id}')"
