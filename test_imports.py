print("Testing Python imports...")
try:
    import moviepy
    from moviepy.editor import VideoFileClip
    print("MoviePy imported successfully:", moviepy.__version__)
    
    import openai
    print("OpenAI imported successfully")
    
    from dotenv import load_dotenv
    print("python-dotenv imported successfully")
    
    import numpy
    print("NumPy imported successfully:", numpy.__version__)
except ImportError as e:
    print(f"Import error: {e}")