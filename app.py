import os
import logging
import json
import time
import numpy as np
from typing import List, Dict, Any
from moviepy.editor import VideoFileClip
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Check if we're in demo mode (without API key)
DEMO_MODE = os.environ.get('OPENAI_API_KEY') is None
if DEMO_MODE:
    logging.warning("Running in DEMO mode without OpenAI API key. Will use mock data.")

# Initialize OpenAI client using environment variable directly
try:
    client = OpenAI()  # OpenAI will automatically use OPENAI_API_KEY from environment
except Exception as e:
    if DEMO_MODE:
        logging.warning(f"OpenAI client initialization failed, but running in demo mode: {e}")
    else:
        raise

def split_audio(input_file: str, segment_length: int = 15 * 60) -> List[str]:
    """
    Split a long audio file into segments of the specified length (in seconds).
    OpenAI's Whisper API has a limit of 25MB which is roughly 25 minutes of audio.
    We'll use segments of 15 minutes to be safe.
    
    Args:
        input_file: Path to the video file to extract audio from
        segment_length: Length of each segment in seconds (default: 15 minutes)
        
    Returns:
        List of paths to the temporary audio segments
    """
    logging.info(f"Splitting audio from video: {input_file} into segments")
    
    try:
        with VideoFileClip(input_file) as video:
            # Get the duration of the video
            duration = video.duration
            logging.info(f"Video duration: {duration} seconds")
            
            # If the video is shorter than segment_length, no need to split
            if duration <= segment_length:
                temp_audio_file = "temp_audio_full.mp3"
                video.audio.write_audiofile(temp_audio_file)
                return [temp_audio_file]
            
            # Create segments
            temp_files = []
            num_segments = int(np.ceil(duration / segment_length))
            logging.info(f"Splitting into {num_segments} segments")
            
            for i in range(num_segments):
                start_time = i * segment_length
                end_time = min((i + 1) * segment_length, duration)
                
                # Extract the segment
                segment = video.subclip(start_time, end_time)
                temp_file = f"temp_audio_segment_{i}.mp3"
                segment.audio.write_audiofile(temp_file)
                temp_files.append(temp_file)
                
            return temp_files
            
    except Exception as e:
        logging.error(f"Error splitting audio: {str(e)}")
        return []

def merge_transcript_segments(transcript_segments: List[Dict[str, Any]], segment_lengths: List[float]) -> Dict[str, Any]:
    """
    Merge multiple transcript segments into a single transcript, adjusting timestamps.
    
    Args:
        transcript_segments: List of transcript dictionaries from the API
        segment_lengths: List of durations for each segment to adjust timestamps
        
    Returns:
        A merged transcript dictionary
    """
    if not transcript_segments:
        return {}
    
    if len(transcript_segments) == 1:
        return transcript_segments[0]
    
    # Initialize the merged transcript with basic structure from the first segment
    merged = {
        "task": transcript_segments[0].get("task", "transcribe"),
        "language": transcript_segments[0].get("language", "english"),
        "duration": sum(segment_lengths),
        "text": "",
        "segments": []
    }
    
    # Keep track of the current offset for adjusting timestamps
    current_offset = 0
    segment_id = 0
    
    # Process each transcript segment
    for i, transcript in enumerate(transcript_segments):
        # Adjust segment text
        merged["text"] += transcript.get("text", "") + " "
        
        # Adjust segments with correct timestamps
        for segment in transcript.get("segments", []):
            new_segment = segment.copy()
            new_segment["id"] = segment_id
            new_segment["start"] += current_offset
            new_segment["end"] += current_offset
            
            # Adjust word timestamps if they exist
            if "words" in new_segment:
                for word in new_segment["words"]:
                    word["start"] += current_offset
                    word["end"] += current_offset
            
            merged["segments"].append(new_segment)
            segment_id += 1
        
        # Update the offset for the next segment
        current_offset += segment_lengths[i]
    
    logging.info(f"Merged {len(transcript_segments)} transcript segments successfully")
    return merged

def transcribe_video(input_file: str) -> Dict[str, Any]:
    logging.info(f"Transcribing video: {input_file}")
    
    # Use mock data if in demo mode
    if DEMO_MODE:
        logging.info("Using mock transcription data (DEMO mode)")
        # Mock transcript data
        mock_transcript = {
            "task": "transcribe",
            "language": "english",
            "duration": 120.5,
            "text": "Welcome to the Wild Kratts! Today we're exploring the amazing Amazon rainforest. Did you know that the poison dart frog has enough toxin to take down ten grown men? Amazing! And look at that, a sloth moves so slowly that algae grows on its fur, creating a mini ecosystem.",
            "segments": [
                {
                    "id": 0,
                    "start": 0.0,
                    "end": 5.0,
                    "text": "Welcome to the Wild Kratts!",
                    "words": [{"word": "Welcome", "start": 0.0, "end": 1.2},
                             {"word": "to", "start": 1.3, "end": 1.5},
                             {"word": "the", "start": 1.6, "end": 1.8},
                             {"word": "Wild", "start": 1.9, "end": 2.5},
                             {"word": "Kratts!", "start": 2.6, "end": 5.0}]
                },
                {
                    "id": 1,
                    "start": 5.5,
                    "end": 15.0,
                    "text": "Today we're exploring the amazing Amazon rainforest.",
                    "words": [{"word": "Today", "start": 5.5, "end": 6.0},
                              {"word": "we're", "start": 6.1, "end": 6.5},
                              {"word": "exploring", "start": 6.6, "end": 7.5},
                              {"word": "the", "start": 7.6, "end": 7.8},
                              {"word": "amazing", "start": 7.9, "end": 9.0},
                              {"word": "Amazon", "start": 9.1, "end": 10.5},
                              {"word": "rainforest.", "start": 10.6, "end": 15.0}]
                },
                {
                    "id": 2,
                    "start": 16.0,
                    "end": 25.0,
                    "text": "Did you know that the poison dart frog has enough toxin to take down ten grown men?",
                    "words": [{"word": "Did", "start": 16.0, "end": 16.5},
                             {"word": "you", "start": 16.6, "end": 16.8},
                             {"word": "know", "start": 16.9, "end": 17.2},
                             {"word": "that", "start": 17.3, "end": 17.5},
                             {"word": "the", "start": 17.6, "end": 17.8},
                             {"word": "poison", "start": 17.9, "end": 18.5},
                             {"word": "dart", "start": 18.6, "end": 19.0},
                             {"word": "frog", "start": 19.1, "end": 19.5},
                             {"word": "has", "start": 19.6, "end": 20.0},
                             {"word": "enough", "start": 20.1, "end": 20.5},
                             {"word": "toxin", "start": 20.6, "end": 21.0},
                             {"word": "to", "start": 21.1, "end": 21.2},
                             {"word": "take", "start": 21.3, "end": 21.8},
                             {"word": "down", "start": 21.9, "end": 22.5},
                             {"word": "ten", "start": 22.6, "end": 23.0},
                             {"word": "grown", "start": 23.1, "end": 24.0},
                             {"word": "men?", "start": 24.1, "end": 25.0}]
                }
            ]
        }
        return mock_transcript
        
    try:
        # Split the video into manageable audio chunks
        audio_segments = split_audio(input_file)
        if not audio_segments:
            logging.error("Failed to split audio from video")
            return None
        
        # Get the duration of each segment for timestamp adjustment
        segment_durations = []
        with VideoFileClip(input_file) as video:
            total_duration = video.duration
            segment_length = 15 * 60  # 15 minutes in seconds
            
            for i in range(len(audio_segments)):
                start_time = i * segment_length
                end_time = min((i + 1) * segment_length, total_duration)
                segment_durations.append(end_time - start_time)
        
        # Process each audio segment
        transcript_segments = []
        for i, audio_file in enumerate(audio_segments):
            logging.info(f"Transcribing audio segment {i+1}/{len(audio_segments)}")
            
            try:
                # Open the audio file and send it to the OpenAI API
                with open(audio_file, "rb") as file:
                    transcript = client.audio.transcriptions.create(
                        model="whisper-1",
                        file=file,
                        response_format="verbose_json",
                        timestamp_granularities=["segment", "word"]
                    )
                
                transcript_segments.append(transcript.model_dump())
                logging.info(f"Successfully transcribed segment {i+1}")
            except Exception as e:
                logging.error(f"Error transcribing segment {i+1}: {str(e)}")
                # Continue with other segments even if one fails
            finally:
                # Clean up the temporary audio file
                try:
                    os.remove(audio_file)
                    logging.info(f"Removed temporary audio file: {audio_file}")
                except Exception as e:
                    logging.error(f"Error removing temporary file {audio_file}: {str(e)}")
        
        # Merge the transcript segments and adjust timestamps
        if transcript_segments:
            merged_transcript = merge_transcript_segments(transcript_segments, segment_durations)
            logging.info(f"Transcription completed for: {input_file}")
            return merged_transcript
        else:
            logging.error("No transcript segments were successfully generated")
            return None
            
    except Exception as e:
        logging.error(f"Error transcribing video {input_file}: {str(e)}")
        return None

def analyze_transcript(transcription: Dict[str, Any]) -> List[Dict[str, Any]]:
    logging.info("Analyzing transcript with AI")
    
    # Use mock data if in demo mode
    if DEMO_MODE:
        logging.info("Using mock analysis data (DEMO mode)")
        # Mock analysis response
        mock_clips = [
            {
                "timecodes": [16.0, 25.0],
                "description": "This segment features the fascinating poison dart frog, showcasing its surprising toxicity. The Kratt brothers' enthusiastic explanation and animated visuals make this fact engaging for viewers of all ages. The vibrant colors of the frog combined with the amazing fact about its poison potency creates a perfect mix of visual appeal and educational value.",
                "entertainment_score": 9,
                "educational_score": 10,
                "clarity_score": 9,
                "shareability_score": 10,
                "length_score": 10,
                "analysis": {
                    "animal_facts": [
                        "Poison dart frogs contain enough toxin to take down ten adult humans",
                        "These frogs are among the most toxic animals on Earth",
                        "Their bright colors warn predators of their toxicity"
                    ],
                    "context_and_setup": "The clip begins with Chris asking a provocative question that immediately hooks the viewer's interest, creating curiosity about what makes this tiny frog so special.",
                    "emotional_engagement": "Martin's exaggerated reaction of surprise and disbelief creates an emotional response that helps viewers understand the significance of this fact. The brothers' enthusiasm is contagious.",
                    "follow_up": "After revealing the main fact, they explain how these frogs use this defense mechanism in the wild, providing important ecological context.",
                    "educational_entertainment_balance": "This clip perfectly balances the shocking fact about the frog's toxicity with the brothers' entertaining reactions, making the educational content highly engaging."
                },
                "text_hook": "This tiny frog could take down 10 grown men! 🐸☠️"
            }
        ]
        return mock_clips
    
    # Access segments from the transcription dictionary
    segments = transcription.get("segments", [])

    # Prepare the transcript text with timestamps
    transcript_text = ""
    for segment in segments:
        start_time = segment.get("start", 0)
        end_time = segment.get("end", 0)
        text = segment.get("text", "")
        transcript_text += f"[{start_time:.2f} - {end_time:.2f}] {text}\n"

    # Define the JSON template separately to avoid f-string issues
    json_template = '''
    {
        "clips": [
            {
                "timecodes": [start_time, end_time],
                "description": "Detailed explanation of viral potential",
                "entertainment_score": 0-10,
                "educational_score": 0-10,
                "clarity_score": 0-10,
                "shareability_score": 0-10,
                "length_score": 0-10,
                "analysis": {
                    "animal_facts": ["Fact1", "Fact2"],
                    "context_and_setup": "Description of how the setup creates a smooth lead-in to the fact",
                    "emotional_engagement": "Description of emotional reactions, excitement, or narrative",
                    "follow_up": "Description of the additional information or reactions after the fact",
                    "educational_entertainment_balance": "Description of how the clip balances education and fun"
                },
                "text_hook": "Suggested text hook for the start of the video"
            }
        ]
    }
    '''

    prompt = f"""
        You are a social media expert and viral content creator specializing in educational content about animals. Your task is to analyze the following transcript from a Wild Kratts episode, focusing on finding 3-5 segments that would make entertaining, educational, and shareable social media clips about animals. Each segment should be 30-90 seconds long, prioritizing this segment length over the number of segments.

        ### Step 1: Carefully read and understand the entire transcript.

        ### Step 2: Identify potential viral segments based on the following criteria:
        a) **Entertainment value** (Is the content engaging, fun, and dynamic? Does it include any exciting visuals or actions, especially between the Kratt Brothers and animals?)  
        b) **Educational value** (Does the segment teach something interesting, surprising, or insightful about animals?)  
        c) **Clarity of dialogue** (Is the message about animals clear and easy to understand?)  
        d) **Shareability** (Would this segment encourage viewers to share or engage on social media, based on emotional or surprising moments?)
        e) **Length** (Is the segment between 30-90 seconds long? Prioritize segments that fit this range while maintaining high engagement.)

        ### Step 3: For each potential segment, ensure there is sufficient **context, setup, and emotional engagement**:
        - **Setup**: Does the segment include a clear beginning that builds curiosity or sets the stage for an engaging fact or story?
        - **Emotional Engagement**: Does the segment include emotional reactions, excitement, or surprise that could resonate with viewers? Does it build a narrative or suspense before delivering the fact?
        - **Fact Delivery**: Highlight the key animal fact, ensuring that it is delivered within a dynamic or engaging context.
        - **Follow-Up**: Does the segment have a natural resolution or reaction after the fact, creating a sense of completion for the viewer?

        ### Step 4: Based on your analysis, select the top 1-3 segments that have the highest potential to educate, entertain, and go viral.

        ### Step 5: For each selected segment, provide:
        1. Start and end timecodes (use the exact timecodes from the transcript).
        2. A detailed description of why this segment would make an excellent viral clip, including:
        - The animal(s) featured and their key behaviors or facts discussed.
        - Why this segment would captivate and emotionally engage viewers, especially children.
        - How it aligns with current social media trends related to animal content (e.g., surprising animal facts, emotional storytelling, dynamic visuals).
        3. A suggested **text hook** to overlay at the start of the video that grabs attention (e.g., "Did you know this about [animal]?" or "Meet one of the fastest animals in the world!").
        4. A score out of 10 for each of the five criteria mentioned in Step 2.
        5. A summary of how the clip mixes education with entertainment and its overall emotional impact.

        ### Length Score Calculation:
        Calculate the length_score as follows:
        - If the segment is between 30-90 seconds: score = 10
        - If the segment is 20-30 or 90-100 seconds: score = 8
        - If the segment is 10-20 or 100-110 seconds: score = 6
        - If the segment is 0-10 or 110-120 seconds: score = 4
        - If the segment is longer than 120 seconds: score = 2

        ### Transcript:
        {transcript_text}

        ### Respond in the following JSON format:
        {json_template}

        ### Important Note:
        Ensure that the duration between start_time and end_time is at least 30 seconds. If any segment is less than 30 seconds, discard it and select another segment that meets the minimum duration requirement.
    """
    
    try:
        response = client.chat.completions.create(
            model="gpt-4.5-preview",  # Using GPT-4 for better analysis
            messages=[
                {"role": "system", "content": "You are a world-class social media expert and viral content creator."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            response_format={ "type": "json_object" }  # Updated to use json_object instead of json
        )
        
        if response.choices and len(response.choices) > 0:
            content = response.choices[0].message.content
            try:
                viral_clips = json.loads(content)
                if 'clips' in viral_clips:
                    logging.info("Transcript analysis completed")
                    return viral_clips['clips']
                else:
                    logging.error("Error analyzing transcript: 'clips' key not found in response JSON")
            except json.JSONDecodeError as e:
                logging.error(f"Error parsing JSON response: {str(e)}")
        else:
            logging.error("Error analyzing transcript: Unexpected API response format")

    except Exception as e:
        logging.error(f"Error analyzing transcript: {str(e)}")

    return []  # Return an empty list if there's any error

def create_vertical_clips(input_file: str, viral_clips: List[Dict[str, Any]], output_folder: str) -> None:
    logging.info(f"Creating vertical clips from: {input_file}")
    
    # Use mock processing in demo mode
    if DEMO_MODE:
        logging.info("Using mock clip creation (DEMO mode)")
        
        # Just copy the input file to simulate creating clips
        try:
            # Make sure the output folder exists
            os.makedirs(output_folder, exist_ok=True)
            
            for i, clip_info in enumerate(viral_clips, 1):
                # Get the file extension from the input file
                file_extension = os.path.splitext(input_file)[1]
                # Create clip filenames
                clip_output = os.path.join(output_folder, f"viral_clip_{i}{file_extension}")
                
                # In demo mode, we just copy the original video as a placeholder
                # In a real scenario, we would create vertical clips with the proper timecodes
                import shutil
                shutil.copy(input_file, clip_output)
                logging.info(f"Demo vertical clip {i} created: {clip_output}")
            
            return
        except Exception as e:
            logging.error(f"Error in demo clip creation: {str(e)}")
            return
    
    # Real processing for non-demo mode
    try:
        # Patch moviepy to use the right resize method
        from moviepy.video.fx.resize import resize
        from moviepy.video.VideoClip import VideoClip
        
        # Monkey patch the resize function in moviepy to avoid using ANTIALIAS
        original_resize = VideoClip.resize
        
        def patched_resize(clip, newsize=None, height=None, width=None, apply_to_mask=True):
            """Monkey patched resize that avoids using ANTIALIAS"""
            logging.info("Using patched resize method for compatibility with Pillow 10+")
            
            # Handle the case where height is specified
            if height is not None:
                if width is None:
                    width = int(clip.w * height / clip.h)
                newsize = (width, height)
            
            # Handle the case where width is specified
            elif width is not None:
                if height is None:
                    height = int(clip.h * width / clip.w)
                newsize = (width, height)
            
            # If we have the new size, use the original resize function but skip apply_to_mask
            # which causes the ANTIALIAS issue
            if newsize is not None:
                # Create a new clip with the resized frames
                new_clip = clip.copy()
                new_clip.size = newsize
                
                # Patch the make_frame function
                old_make_frame = clip.make_frame
                def new_make_frame(t):
                    frame = old_make_frame(t)
                    from PIL import Image
                    # Convert numpy array to PIL Image
                    pil_frame = Image.fromarray(frame)
                    # Resize using LANCZOS instead of ANTIALIAS
                    # LANCZOS is the modern replacement for ANTIALIAS
                    if hasattr(Image, 'Resampling'):
                        resized_frame = pil_frame.resize(newsize, Image.Resampling.LANCZOS)
                    else:
                        # Fallback for older Pillow versions
                        resized_frame = pil_frame.resize(newsize, Image.LANCZOS if hasattr(Image, 'LANCZOS') else Image.BICUBIC)
                    # Convert back to numpy array
                    return np.array(resized_frame)
                
                new_clip.make_frame = new_make_frame
                
                # Handle mask if needed and if the clip has a mask
                if apply_to_mask and clip.mask is not None:
                    new_clip.mask = patched_resize(clip.mask, newsize=newsize, apply_to_mask=False)
                
                return new_clip
            
            return clip  # Return original clip if no resize needed
        
        # Temporarily replace the resize method
        VideoClip.resize = patched_resize
        
        # Now process videos using our patched resize
        with VideoFileClip(input_file) as video:
            for i, clip_info in enumerate(viral_clips, 1):
                start, end = clip_info['timecodes']
                segment = video.subclip(start, end)
                
                # Resize to vertical format (9:16 aspect ratio)
                # First resize to appropriate height
                vertical_segment = segment.resize(height=1920)
                # Then center crop to 9:16 ratio
                vertical_segment = vertical_segment.crop(x_center=vertical_segment.w/2, width=1080)
                
                # Save individual vertical clips
                clip_output = os.path.join(output_folder, f"viral_clip_{i}{os.path.splitext(input_file)[1]}")
                vertical_segment.write_videofile(clip_output, codec='libx264')
                logging.info(f"Vertical clip {i} created: {clip_output}")
        
        # Restore the original resize method
        VideoClip.resize = original_resize
        
        logging.info(f"All vertical clips created for: {input_file}")
    except Exception as e:
        logging.error(f"Error creating vertical clips for {input_file}: {str(e)}")
        logging.error(f"Exception details: {type(e).__name__}: {str(e)}")
        
        # No fallback to copying - we want to fix the resize issue

def save_metadata(viral_clips: List[Dict[str, Any]], output_folder: str) -> None:
    metadata_file = os.path.join(output_folder, "viral_clips_metadata.json")
    with open(metadata_file, 'w') as f:
        json.dump(viral_clips, f, indent=2)
    logging.info(f"Metadata saved in {metadata_file}")

def process_video(input_file: str, output_folder: str) -> None:
    logging.info(f"Processing video: {input_file}")
    
    # Step 1: Transcribe the video
    transcription = transcribe_video(input_file)
    if not transcription:
        return
    
    # Step 2: Analyze the transcript and get viral clip suggestions
    viral_clips = analyze_transcript(transcription)
    if not viral_clips:
        return
    
    # Step 3: Create vertical clips based on the analysis
    create_vertical_clips(input_file, viral_clips, output_folder)
    
    # Save metadata
    save_metadata(viral_clips, output_folder)

def process_folder(input_folder: str, output_folder: str = None) -> None:
    logging.info(f"Starting to process folder: {input_folder}")
    
    # If it's a file, process it directly
    if os.path.isfile(input_folder):
        if output_folder is None:
            # Create output folder next to the input file
            parent_dir = os.path.dirname(input_folder)
            output_folder = os.path.join(parent_dir, "Viral_Clips")
        os.makedirs(output_folder, exist_ok=True)
        logging.info(f"Created output directory: {output_folder}")
        process_video(input_folder, output_folder)
        logging.info(f"Finished processing file: {input_folder}")
        return
    
    # If it's a folder, process all videos in it
    if output_folder is None:
        output_folder = os.path.join(input_folder, "Viral_Clips")
    
    os.makedirs(output_folder, exist_ok=True)
    logging.info(f"Created output directory: {output_folder}")
    
    files = os.listdir(input_folder)
    logging.info(f"Files in folder: {files}")
    for filename in files:
        if filename.lower().endswith(('.mov', '.mp4')):
            input_file = os.path.join(input_folder, filename)
            process_video(input_file, output_folder)
            logging.info(f"Finished processing {filename}")
        else:
            logging.info(f"Skipping file: {filename} (not a .mov or .mp4 file)")
    logging.info(f"Finished processing folder: {input_folder}")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python viral.py <input_path> [output_folder]")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_folder = sys.argv[2] if len(sys.argv) > 2 else None
    
    logging.info(f"Starting script with input path: {input_path}")
    logging.info(f"Output folder: {output_folder}")
    
    if os.path.exists(input_path):
        logging.info(f"Input path exists: {input_path}")
        process_folder(input_path, output_folder)
    else:
        logging.error(f"Input path does not exist: {input_path}")
    
    logging.info("Script execution completed")