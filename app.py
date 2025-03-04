import os
import logging
import json
import time
from typing import List, Dict, Any
from moviepy.editor import VideoFileClip
from openai import OpenAI

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Initialize OpenAI client using environment variable directly
client = OpenAI()  # OpenAI will automatically use OPENAI_API_KEY from environment

def transcribe_video(input_file: str) -> Dict[str, Any]:
    logging.info(f"Transcribing video: {input_file}")
    try:
        with VideoFileClip(input_file) as video:
            # Extract audio and save as a temporary file
            temp_audio_file = "temp_audio.mp3"
            video.audio.write_audiofile(temp_audio_file)

        # Open the audio file and send it to the OpenAI API
        with open(temp_audio_file, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                timestamp_granularities=["segment", "word"]
            )

        # Remove the temporary audio file
        os.remove(temp_audio_file)

        logging.info(f"Transcription completed for: {input_file}")
        return transcript.model_dump()  # Convert Pydantic model to dict
    except Exception as e:
        logging.error(f"Error transcribing video {input_file}: {str(e)}")
        return None

def analyze_transcript(transcription: Dict[str, Any]) -> List[Dict[str, Any]]:
    logging.info("Analyzing transcript with AI")
    
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
            model="gpt-4o",  # Using GPT-4 for better analysis
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
    try:
        with VideoFileClip(input_file) as video:
            for i, clip_info in enumerate(viral_clips, 1):
                start, end = clip_info['timecodes']
                segment = video.subclip(start, end)
                
                # Resize and crop for vertical format
                vertical_segment = segment.resize(height=1920)
                vertical_segment = vertical_segment.crop(x_center=vertical_segment.w/2, width=1080)
                
                # Save individual vertical clips
                clip_output = os.path.join(output_folder, f"viral_clip_{i}{os.path.splitext(input_file)[1]}")
                vertical_segment.write_videofile(clip_output, codec='libx264')
                logging.info(f"Vertical clip {i} created: {clip_output}")
        
        logging.info(f"All vertical clips created for: {input_file}")
    except Exception as e:
        logging.error(f"Error creating vertical clips for {input_file}: {str(e)}")

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