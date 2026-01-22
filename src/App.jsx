// Updated saveTeamPlayers function to properly synchronize players with Supabase

const saveTeamPlayers = async (players) => {
    // Ensure we are working with the latest player data from Supabase
    try {
        const { data, error } = await supabase
            .from('players')
            .upsert(players);

        if (error) throw error;

        console.log('Players saved successfully:', data);
    } catch (error) {
        console.error('Error saving players:', error);
    }
};

// ManagePlayersView component rewrite for better state handling and synchronization
const ManagePlayersView = () => {
    const [players, setPlayers] = useState([]);
    const fetchPlayers = async () => {
        const { data, error } = await supabase
            .from('players')
            .select('*');

        if (error) console.error(error);
        else setPlayers(data);
    };

    useEffect(() => {
        fetchPlayers(); // Fetch players on component mount
    }, []);

    const handleSave = async () => {
        await saveTeamPlayers(players);
    };
    
    return (
        <div>
            <h1>Manage Players</h1>
            {/* UI to display and manage players */}
            <button onClick={handleSave}>Save Players</button>
        </div>
    );
};
