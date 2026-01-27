"""
Authentication module for bbpy.
Handles .id file authentication and Selenium login.
"""

import json
import time
from pathlib import Path
from typing import Optional

import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException

from bbpy.exceptions import BBAuthError



def parse_course_info(course_name: str, course_id: str) -> dict:
    """
    Parse course name and ID to extract class name and clean course name/ID.
    
    Course names are formatted as: "Course Name__ClassName" (e.g., "Gestion de projet__4SAE11")
    Course IDs are formatted as: "CourseCode__ClassName" (e.g., "ESE.PR-01__4SAE11")
    
    Args:
        course_name: Full course name with class suffix
        course_id: Full course ID with class suffix
        
    Returns:
        Dictionary with parsed info: name, course_id, class_name
    """
    # Extract class name from course name (after __)
    class_name = None
    clean_name = course_name
    if "__" in course_name:
        parts = course_name.split("__")
        clean_name = parts[0]
        class_name = parts[1] if len(parts) > 1 else None
    
    # Extract clean course ID (before __)
    clean_id = course_id
    if "__" in course_id:
        clean_id = course_id.split("__")[0]
    
    return {
        "name": clean_name,
        "course_id": clean_id,
        "class_name": class_name
    }


def save_id_file(
    id_path: str,
    session: requests.Session,
    user_data: dict,
    courses: list,
    instructors: list,
    username: str = None,
    password: str = None
) -> None:
    """
    Save enriched .id file with cookies, user data, course information, and credentials.
    
    Args:
        id_path: Path to save the .id file
        session: requests.Session with cookies
        user_data: User information dictionary
        courses: List of enrolled courses
        instructors: List of instructors with course info
        username: Blackboard username (optional, for auto-refresh)
        password: Blackboard password (optional, for auto-refresh)
    """
    from datetime import datetime
    
    # Extract cookies as list to handle duplicates (e.g., multiple BbRouter cookies)
    cookies = []
    for cookie in session.cookies:
        cookies.append({
            "name": cookie.name,
            "value": cookie.value,
            "domain": cookie.domain,
            "path": cookie.path
        })
    
    # Extract user info
    name_obj = user_data.get("name", {})
    full_name = f"{name_obj.get('given', '')} {name_obj.get('family', '')}".strip()
    username = user_data.get("userName", "")
    email = user_data.get("contact", {}).get("email", "")
    
    # Determine class name from first course
    class_name = None
    if courses:
        first_course = courses[0]
        course_name = first_course.get("name", "")
        if "__" in course_name:
            class_name = course_name.split("__")[1]
    
    # Build instructor lookup by course name
    instructor_lookup = {}
    for instructor in instructors:
        course_info = instructor.get("course", {})
        course_name_full = course_info.get("name", "")
        
        name_obj = instructor.get("name", {})
        prof_name = f"{name_obj.get('given', '')} {name_obj.get('family', '')}".strip()
        
        if course_name_full not in instructor_lookup:
            instructor_lookup[course_name_full] = []
        if prof_name and prof_name not in instructor_lookup[course_name_full]:
            instructor_lookup[course_name_full].append(prof_name)
    
    # Build courses list with parsed info and professors
    courses_data = []
    for course in courses:
        course_name_full = course.get("name", "")
        course_id_full = course.get("courseId", "")
        
        parsed = parse_course_info(course_name_full, course_id_full)
        
        # Get professors for this course
        professors = instructor_lookup.get(course_name_full, [])
        
        # Extract internal ID from externalAccessUrl (e.g., "_16318_1" from ".../courses/_16318_1/...")
        internal_id = course.get("id")  # This is the internal ID like "_16318_1"
        external_url = course.get("externalAccessUrl", "")
        
        courses_data.append({
            "name": parsed["name"],
            "course_id": parsed["course_id"],  # Course code like "ESE.TC-21"
            "internal_id": internal_id,  # Internal ID like "_16318_1" for API calls
            "url": external_url,  # Full URL to course
            "professors": professors
        })
    
    # Build the .id file structure
    id_data = {
        "generated_at": datetime.now().isoformat(),
        "cookies": cookies,
        "credentials": {
            "username": username.upper() if username else None,
            "password": password
        } if username and password else None,
        "user": {
            "name": full_name,
            "username": username or user_data.get("userName", ""),
            "email": email,
            "class": class_name
        },
        "courses": courses_data,
        # Stats flags (will be updated by is_nerd() and is_attending())
        "isNerd": None,
        "isAttending": None,
        "on_time_rate": None,
        "attendance_percentage": None
    }
    
    # Remove credentials key if not provided
    if not id_data["credentials"]:
        del id_data["credentials"]
    
    with open(id_path, 'w', encoding='utf-8') as f:
        json.dump(id_data, f, indent=2, ensure_ascii=False)


def update_id_file_cookies(id_path: str, session: requests.Session) -> None:
    """
    Update only the cookies in an existing .id file, preserving all other data.
    This is useful when session expires and we only need to refresh cookies.
    
    Args:
        id_path: Path to the .id file to update
        session: requests.Session with new cookies
        
    Raises:
        BBAuthError: If .id file cannot be loaded or updated
    """
    from datetime import datetime
    
    try:
        # Load existing .id file
        with open(id_path, 'r', encoding='utf-8') as f:
            id_data = json.load(f)
        
        # Extract new cookies from session
        cookies = []
        for cookie in session.cookies:
            cookies.append({
                "name": cookie.name,
                "value": cookie.value,
                "domain": cookie.domain,
                "path": cookie.path
            })
        
        # Update only cookies and timestamp
        id_data["cookies"] = cookies
        id_data["updated_at"] = datetime.now().isoformat()
        
        # Save back to file
        with open(id_path, 'w', encoding='utf-8') as f:
            json.dump(id_data, f, indent=2, ensure_ascii=False)
            
    except FileNotFoundError:
        raise BBAuthError(f"ID file not found: {id_path}")
    except json.JSONDecodeError:
        raise BBAuthError(f"Invalid ID file format: {id_path}")


def load_id_file(id_path: str) -> tuple:
    """
    Load .id file and return session with cookies and cached data.
    
    Args:
        id_path: Path to the .id file
        
    Returns:
        Tuple of (requests.Session, cached_data dict)
        cached_data includes: generated_at, user, courses, and optionally credentials
        
    Raises:
        BBAuthError: If .id file cannot be loaded
    """
    try:
        with open(id_path, 'r', encoding='utf-8') as f:
            id_data = json.load(f)
        
        # Create session with cookies
        session = requests.Session()
        cookies = id_data.get("cookies", [])
        
        # Handle both list format (new) and dict format (legacy)
        if isinstance(cookies, list):
            for cookie in cookies:
                session.cookies.set(
                    cookie.get("name"),
                    cookie.get("value"),
                    domain=cookie.get("domain", ""),
                    path=cookie.get("path", "/")
                )
        else:
            # Legacy dict format
            for name, value in cookies.items():
                session.cookies.set(name, value)
        
        # Return session and cached data (including credentials if present)
        cached_data = {
            "generated_at": id_data.get("generated_at"),
            "user": id_data.get("user", {}),
            "courses": id_data.get("courses", []),
            "credentials": id_data.get("credentials")  # May be None
        }
        
        return session, cached_data
        
    except FileNotFoundError:
        raise BBAuthError(f"ID file not found: {id_path}")
    except json.JSONDecodeError:
        raise BBAuthError(f"Invalid ID file format: {id_path}")


def login_with_selenium(
    username: str,
    password: str,
    domain: str = "https://esprit.blackboard.com",
    headless: bool = False,
    timeout: int = 10
) -> requests.Session:
    """
    Use Selenium to automate browser login and capture cookies.
    
    Args:
        username: Blackboard username
        password: Blackboard password
        domain: Blackboard domain URL
        headless: Run browser in headless mode
        timeout: Timeout for waiting on elements (seconds)
        
    Returns:
        requests.Session with authenticated cookies
        
    Raises:
        BBAuthError: If login fails
    """
    login_url = f"{domain}/webapps/login/"
    
    options = webdriver.ChromeOptions()
    if headless:
        options.add_argument('--headless')
    
    driver = webdriver.Chrome(options=options)
    
    try:
        driver.get(login_url)
        time.sleep(2)
        
        # Handle cookie consent if present
        try:
            cookie_button = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.ID, "agree_button"))
            )
            cookie_button.click()
            time.sleep(1)
        except TimeoutException:
            pass  # No cookie consent button
        
        # Find and fill login fields
        try:
            username_field = WebDriverWait(driver, timeout).until(
                EC.presence_of_element_located((By.ID, "user_id"))
            )
            password_field = driver.find_element(By.ID, "password")
            
            username_field.send_keys(username)
            password_field.send_keys(password)
            
            login_button = driver.find_element(By.ID, "entry-login")
            login_button.click()
            
            time.sleep(5)  # Wait for login to complete
            
            # Check if login was successful
            if "login" in driver.current_url.lower() and "logged" not in driver.current_url.lower():
                raise BBAuthError("Login failed - still on login page. Check credentials.")
            
            # Capture cookies
            cookies = driver.get_cookies()
            session = requests.Session()
            for cookie in cookies:
                session.cookies.set(cookie['name'], cookie['value'])
            
            return session
            
        except TimeoutException:
            raise BBAuthError("Could not find login fields on the page")
            
    except Exception as e:
        if isinstance(e, BBAuthError):
            raise
        raise BBAuthError(f"Browser automation error: {e}")
        
    finally:
        driver.quit()
