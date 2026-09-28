namespace api.Models
{
    public class WardrobeItem
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Brand { get; set; }
        public string? Size { get; set; }
        public int WearCount { get; set; }
        public string Status { get; set; } = string.Empty;
        public bool IsDeleted { get; set; }


    }
}
