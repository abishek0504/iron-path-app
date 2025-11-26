# IronPath

A cross-platform workout planner and tracker built with React Native, Expo Router, and Supabase. IronPath uses AI to generate personalized workout plans based on your fitness goals and profile.

## Features

### 🤖 AI-Powered Workout Generation
- Generate complete weekly workout plans tailored to your:
  - Age, gender, height, and weight
  - Fitness goals (Strength, Hypertrophy, Endurance, Weight Loss, General Fitness)
  - Training days per week
  - Available equipment
- Plans include exercises with target sets, reps, rest times, and technique tips

### 📅 Weekly Workout Planning
- View and manage your weekly workout schedule
- Edit individual days with drag-and-drop exercise reordering
- Add exercises manually from a curated database
- Create custom exercises with your own settings
- Generate supplementary exercises for any day using AI

### 💪 Workout Execution
- Start workouts directly from the home screen
- Built-in rest timers between sets
- Exercise timers for timed exercises
- Track reps, weight, and duration for each set
- Automatic progress saving (resume anytime)
- Real-time comparison of logged vs. target performance
- Notes for each exercise set

### 📊 Profile Management
- Upload profile pictures
- Set and track fitness goals
- Store personal information (age, weight, height, etc.)
- View workout history and progress

### 📈 Progress Tracking
- View workout history
- Track completed workouts
- Monitor exercise performance over time

## Tech Stack

- **Frontend**: React Native with Expo
- **Navigation**: Expo Router (file-based routing)
- **Backend**: Supabase (PostgreSQL database, authentication, storage)
- **AI**: Google Gemini Pro (workout plan generation)
- **State Management**: React Hooks
- **UI Components**: React Native components with Lucide React Native icons

## How to Use

### Getting Started

1. **Sign Up**: Create a new account with your email and password
2. **Onboarding**: Complete your profile setup:
   - Enter your age, gender, current weight, height
   - Set your fitness goal
   - Choose how many days per week you want to train
3. **Generate Workout Plan**: Go to the Planner tab and tap "Generate Workout Plan"
   - The AI will create a personalized weekly plan based on your profile
   - The plan will be automatically set as your active plan

### Planning Workouts

1. **View Weekly Schedule**: Navigate to the Planner tab to see your active plan
2. **Edit a Day**: Tap on any day to view and edit its exercises
3. **Add Exercises**: 
   - Tap "Add" to browse and select from the exercise database
   - Search for specific exercises
   - Create custom exercises with your own settings
4. **Reorder Exercises**: Drag exercises up or down using the grip handle
5. **Generate Supplementary Exercises**: Tap "Generate Supplementary Exercises" to add AI-suggested exercises that complement your existing plan
6. **Provide Feedback**: After generating exercises, you can provide feedback that will be considered in future generations

### Performing Workouts

1. **View Today's Workout**: The Home tab shows today's scheduled workout
2. **Start Workout**: Tap "Start Workout" to begin
3. **Complete Sets**: 
   - Tap "Complete Set" after finishing a set
   - Rest timer will automatically start
   - You can skip rest if needed
4. **Log Results**: After completing all sets of an exercise:
   - Enter your actual reps and weight
   - Add notes about how it felt
   - Compare your performance to targets
5. **Resume Workouts**: If you exit mid-workout, you can resume where you left off later

### Managing Your Profile

1. **Edit Profile**: Navigate to Profile tab and tap "Edit"
2. **Upload Picture**: Tap "Upload Photo" to add a profile picture from your library or camera
3. **Update Information**: Modify your personal details, goals, or preferences
4. **Save Changes**: Tap "Save Changes" to update your profile


## Key Features Explained

### AI Workout Generation
The app uses Google's Gemini Pro model to generate personalized workout plans. It considers:
- Your physical attributes (age, weight, height)
- Your fitness goals
- Training frequency
- Available equipment
- Exercise preferences from feedback

### Workout Session Management
- Workouts are saved as sessions that persist across app restarts
- Progress is saved both locally (AsyncStorage) and in the database
- You can resume workouts at any time

### Exercise Database
- Master exercise database with common exercises
- User-created custom exercises
- Exercise details include descriptions, equipment needed, and timing information

## Development

### Adding New Features
- Follow the existing file structure in `app/`
- Use Supabase for all database operations
- Follow React Native best practices for performance

### Testing
- Test on both iOS and Android
- Test workout session persistence
- Verify AI generation works correctly

## Troubleshooting

### Common Issues

**"Failed to load workout plan"**
- Ensure you have an active plan in the Planner tab
- Check your Supabase connection

**"AI API key not configured"**
- Verify `EXPO_PUBLIC_GEMINI_API_KEY` is set in your `.env` file
- Restart the Expo development server after adding environment variables

**Image upload fails**
- Ensure the `avatars` bucket exists in Supabase Storage
- Check storage bucket permissions

## License

Private project - All rights reserved
