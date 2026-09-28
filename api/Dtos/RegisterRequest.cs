using System.ComponentModel.DataAnnotations;

namespace api.Dtos
{
    public class RegisterRequest
    {

        [Required, EmailAddress]
        public string Email { get; set; } = string.Empty;
        [Required, MinLength(8)]
        public string Password { get; set; } = string.Empty;
        [Required, MaxLength(100)]
        public string DisplayName { get; set; } = string.Empty;


    }
}
